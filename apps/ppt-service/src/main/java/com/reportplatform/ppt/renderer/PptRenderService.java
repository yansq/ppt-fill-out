package com.reportplatform.ppt.renderer;

import com.reportplatform.ppt.model.RenderRequest;
import com.reportplatform.ppt.model.RenderResponse;
import com.reportplatform.ppt.model.RenderedFileMetadata;
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
import java.util.concurrent.TimeUnit;
import javax.imageio.ImageIO;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

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
