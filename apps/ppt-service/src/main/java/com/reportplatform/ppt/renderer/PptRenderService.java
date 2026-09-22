package com.reportplatform.ppt.renderer;

import com.reportplatform.ppt.model.RenderRequest;
import com.reportplatform.ppt.model.RenderResponse;
import com.reportplatform.ppt.model.RenderedFileMetadata;
import com.reportplatform.ppt.model.DraftPreviewRequest;
import com.reportplatform.ppt.model.GenerateRequest;
import com.reportplatform.ppt.model.GenerateResponse;
import com.reportplatform.ppt.model.GeneratedArtifact;
import com.reportplatform.ppt.model.StaticPreviewRequest;
import java.io.ByteArrayOutputStream;
import com.reportplatform.ppt.storage.StoragePathResolver;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.concurrent.TimeUnit;
import javax.imageio.ImageIO;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.apache.poi.xslf.usermodel.XMLSlideShow;
import org.apache.poi.xslf.usermodel.XSLFShape;
import org.apache.poi.xslf.usermodel.XSLFTextShape;

@Service
public class PptRenderService {

    private static final Duration CONVERSION_TIMEOUT = Duration.ofSeconds(90);
    private static final float PREVIEW_DPI = 144f;

    private final StoragePathResolver pathResolver;
    private final String libreOfficeExecutable;

    public PptRenderService(
            StoragePathResolver pathResolver,
            @Value("${app.libre-office.executable}") String libreOfficeExecutable) {
        this.pathResolver = pathResolver;
        this.libreOfficeExecutable = libreOfficeExecutable;
    }

    public RenderResponse render(RenderRequest request) {
        Path templatePath = pathResolver.resolveTemplate(request.relativePath());
        if (!Files.isRegularFile(templatePath) || !Files.isReadable(templatePath)) {
            throw new PptRenderException("Template file is not available");
        }
        verifyHash(templatePath, request.sha256());

        Path workingDirectory = pathResolver.createRenderTempDirectory(UUID.randomUUID().toString());
        try {
            Files.createDirectories(workingDirectory);
            Path pdfPath = convertToPdf(templatePath, workingDirectory);
            List<RenderedFileMetadata> files = renderPdfPages(pdfPath, request.templateId(), workingDirectory);
            return new RenderResponse(
                    request.fileId(),
                    request.outputFormat(),
                    files.size(),
                    files,
                    List.of());
        } catch (IOException exception) {
            throw new PptRenderException("Unable to render PPTX preview", exception);
        } finally {
            deleteRecursively(workingDirectory);
        }
    }

    public byte[] renderStaticPreview(StaticPreviewRequest request) {
        return renderTransientPreview(request.relativePath(), request.sha256(), request.slideIndex(), PlaceholderTextStripper::strip);
    }

    public byte[] renderDraftPreview(DraftPreviewRequest request) {
        return renderTransientPreview(request.relativePath(), request.sha256(), request.slideIndex(),
                show -> PlaceholderTextStripper.fill(show, request.slideIndex(), request.values(), request.highlight()));
    }

    public GenerateResponse generate(GenerateRequest request) {
        Path templatePath = pathResolver.resolveTemplate(request.relativePath());
        if (!Files.isRegularFile(templatePath) || !Files.isReadable(templatePath)) {
            throw new PptRenderException("Template file is not available");
        }
        verifyHash(templatePath, request.sha256());
        Path workingDirectory = pathResolver.createRenderTempDirectory(UUID.randomUUID().toString());
        List<Path> committed = new ArrayList<>();
        boolean succeeded = false;
        try {
            Files.createDirectories(workingDirectory);
            Path pptxPath = workingDirectory.resolve("report.pptx");
            List<String> warnings;
            int pageCount;
            try (InputStream input = Files.newInputStream(templatePath);
                    XMLSlideShow show = new XMLSlideShow(input)) {
                pageCount = show.getSlides().size();
                List<String> baselineWarnings = collectLayoutWarnings(show);
                PlaceholderTextStripper.fillAll(show, request.values());
                warnings = collectLayoutWarnings(show);
                warnings.removeAll(baselineWarnings);
                try (var output = Files.newOutputStream(pptxPath)) {
                    show.write(output);
                }
            }
            Path pdfPath = convertToPdf(pptxPath, workingDirectory);
            List<Path> outputs = new ArrayList<>(List.of(pptxPath, pdfPath));
            try (PDDocument document = Loader.loadPDF(pdfPath.toFile())) {
                if (document.getNumberOfPages() != pageCount) {
                    throw new PptRenderException("Generated PDF page count differs from PPTX");
                }
                PDFRenderer renderer = new PDFRenderer(document);
                for (int slideIndex = 0; slideIndex < pageCount; slideIndex++) {
                    Path pngPath = workingDirectory.resolve("slide-" + (slideIndex + 1) + ".png");
                    BufferedImage image = renderer.renderImageWithDPI(slideIndex, PREVIEW_DPI, ImageType.RGB);
                    if (!ImageIO.write(image, "png", pngPath.toFile())) {
                        throw new PptRenderException("PNG image writer is unavailable");
                    }
                    outputs.add(pngPath);
                }
            }
            List<GeneratedArtifact> files = new ArrayList<>();
            for (int index = 0; index < outputs.size(); index++) {
                Path source = outputs.get(index);
                Path destination = pathResolver.resolveGenerated(request.generationId(), source.getFileName().toString());
                Files.createDirectories(destination.getParent());
                Files.move(source, destination);
                committed.add(destination);
                String type = index == 0 ? "PPTX" : index == 1 ? "PDF" : "PNG";
                String mimeType = index == 0
                        ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
                        : index == 1 ? "application/pdf" : "image/png";
                files.add(new GeneratedArtifact(type, index >= 2 ? index - 2 : null,
                        pathResolver.relativePath(destination), mimeType, Files.size(destination), sha256(destination)));
            }
            succeeded = true;
            return new GenerateResponse(request.generationId(), pageCount, files, warnings);
        } catch (IOException exception) {
            throw new PptRenderException("Unable to generate report files", exception);
        } finally {
            if (!succeeded) {
                for (Path file : committed) {
                    try {
                        Files.deleteIfExists(file);
                    } catch (IOException ignored) {
                        // Preserve the generation failure; P7 cleanup can reconcile orphan files.
                    }
                }
            }
            deleteRecursively(workingDirectory);
        }
    }

    private List<String> collectLayoutWarnings(XMLSlideShow show) {
        List<String> warnings = new ArrayList<>();
        for (int slideIndex = 0; slideIndex < show.getSlides().size(); slideIndex++) {
            for (XSLFShape shape : show.getSlides().get(slideIndex).getShapes()) {
                if (shape instanceof XSLFTextShape textShape && shape.getAnchor() != null
                        && shape.getAnchor().getHeight() > 0
                        && textShape.getTextHeight() > shape.getAnchor().getHeight() + 2) {
                    warnings.add("POSSIBLE_TEXT_OVERFLOW slide=" + (slideIndex + 1)
                            + " shape=" + shape.getShapeId());
                }
            }
        }
        return warnings;
    }

    private byte[] renderTransientPreview(
            String relativePath,
            String sha256,
            int slideIndex,
            Consumer<XMLSlideShow> transform) {
        Path templatePath = pathResolver.resolveTemplate(relativePath);
        if (!Files.isRegularFile(templatePath) || !Files.isReadable(templatePath)) {
            throw new PptRenderException("Template file is not available");
        }
        verifyHash(templatePath, sha256);
        Path workingDirectory = pathResolver.createRenderTempDirectory(UUID.randomUUID().toString());
        try {
            Files.createDirectories(workingDirectory);
            Path strippedPath = workingDirectory.resolve("static-preview.pptx");
            try (InputStream input = Files.newInputStream(templatePath);
                    XMLSlideShow show = new XMLSlideShow(input)) {
                if (slideIndex >= show.getSlides().size()) {
                    throw new PptRenderException("Slide index is out of bounds");
                }
                transform.accept(show);
                for (int index = show.getSlides().size() - 1; index >= 0; index--) {
                    if (index != slideIndex) {
                        show.removeSlide(index);
                    }
                }
                try (var output = Files.newOutputStream(strippedPath)) {
                    show.write(output);
                }
            }
            Path pdfPath = convertToPdf(strippedPath, workingDirectory);
            try (PDDocument document = Loader.loadPDF(pdfPath.toFile())) {
                if (document.getNumberOfPages() != 1) {
                    throw new PptRenderException("Transient preview must render exactly one slide");
                }
                BufferedImage image = new PDFRenderer(document).renderImageWithDPI(0, PREVIEW_DPI, ImageType.RGB);
                try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                    if (!ImageIO.write(image, "png", output)) {
                        throw new PptRenderException("PNG image writer is unavailable");
                    }
                    return output.toByteArray();
                }
            }
        } catch (IOException exception) {
            throw new PptRenderException("Unable to render static PPTX preview", exception);
        } finally {
            deleteRecursively(workingDirectory);
        }
    }

    private Path convertToPdf(Path templatePath, Path workingDirectory) throws IOException {
        Path logPath = workingDirectory.resolve("libreoffice.log");
        Process process = new ProcessBuilder(
                        libreOfficeExecutable,
                        "--headless",
                        "--convert-to",
                        "pdf",
                        "--outdir",
                        workingDirectory.toString(),
                        templatePath.toString())
                .redirectErrorStream(true)
                .redirectOutput(logPath.toFile())
                .start();

        boolean completed;
        try {
            completed = process.waitFor(CONVERSION_TIMEOUT.toSeconds(), TimeUnit.SECONDS);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new PptRenderException("LibreOffice conversion was interrupted", exception);
        }
        if (!completed) {
            process.destroyForcibly();
            throw new PptRenderException("LibreOffice conversion timed out");
        }
        if (process.exitValue() != 0) {
            String output = Files.exists(logPath)
                    ? Files.readString(logPath, StandardCharsets.UTF_8)
                    : "";
            throw new PptRenderException(
                    "LibreOffice conversion failed: " + output.substring(0, Math.min(output.length(), 4_000)).trim());
        }

        try (var candidates = Files.list(workingDirectory)) {
            return candidates
                    .filter(path -> path.getFileName().toString().toLowerCase(Locale.ROOT).endsWith(".pdf"))
                    .findFirst()
                    .orElseThrow(() -> new PptRenderException("LibreOffice did not produce a PDF"));
        }
    }

    private List<RenderedFileMetadata> renderPdfPages(
            Path pdfPath,
            String templateId,
            Path workingDirectory) throws IOException {
        List<Path> temporaryFiles = new ArrayList<>();
        try (PDDocument document = Loader.loadPDF(pdfPath.toFile())) {
            PDFRenderer renderer = new PDFRenderer(document);
            for (int slideIndex = 0; slideIndex < document.getNumberOfPages(); slideIndex++) {
                BufferedImage image = renderer.renderImageWithDPI(slideIndex, PREVIEW_DPI, ImageType.RGB);
                String filename = "slide-" + (slideIndex + 1) + ".png";
                Path temporaryPng = workingDirectory.resolve(filename);
                if (!ImageIO.write(image, "png", temporaryPng.toFile())) {
                    throw new PptRenderException("PNG image writer is unavailable");
                }
                temporaryFiles.add(temporaryPng);
            }
        }
        if (temporaryFiles.isEmpty()) {
            throw new PptRenderException("Rendered presentation contains no pages");
        }

        List<Path> committedFiles = new ArrayList<>();
        List<RenderedFileMetadata> metadata = new ArrayList<>();
        try {
            for (int slideIndex = 0; slideIndex < temporaryFiles.size(); slideIndex++) {
                String filename = "slide-" + (slideIndex + 1) + ".png";
                Path destination = pathResolver.resolvePreview(templateId, filename);
                Files.createDirectories(destination.getParent());
                Files.move(temporaryFiles.get(slideIndex), destination, StandardCopyOption.REPLACE_EXISTING);
                committedFiles.add(destination);
                metadata.add(new RenderedFileMetadata(
                        slideIndex,
                        pathResolver.relativePath(destination),
                        "image/png",
                        Files.size(destination),
                        sha256(destination)));
            }
            return metadata;
        } catch (IOException | RuntimeException exception) {
            for (Path committedFile : committedFiles) {
                try {
                    Files.deleteIfExists(committedFile);
                } catch (IOException ignored) {
                    // Preserve the original render failure.
                }
            }
            throw exception;
        }
    }

    private void verifyHash(Path path, String expectedSha256) {
        String actualSha256 = sha256(path);
        if (!MessageDigest.isEqual(
                actualSha256.getBytes(StandardCharsets.US_ASCII),
                expectedSha256.toLowerCase(Locale.ROOT).getBytes(StandardCharsets.US_ASCII))) {
            throw new PptRenderException("Template file hash does not match request");
        }
    }

    private String sha256(Path path) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (InputStream inputStream = new DigestInputStream(Files.newInputStream(path), digest)) {
                inputStream.transferTo(java.io.OutputStream.nullOutputStream());
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (IOException | NoSuchAlgorithmException exception) {
            throw new PptRenderException("Unable to hash rendered file", exception);
        }
    }

    private void deleteRecursively(Path directory) {
        if (!Files.exists(directory)) {
            return;
        }
        try (var paths = Files.walk(directory)) {
            paths.sorted(Comparator.reverseOrder()).forEach(path -> {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException ignored) {
                    // Temporary cleanup failure must not hide the render result.
                }
            });
        } catch (IOException ignored) {
            // Temporary cleanup failure must not hide the render result.
        }
    }
}
