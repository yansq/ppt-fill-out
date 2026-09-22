package com.reportplatform.ppt.renderer;

import static org.assertj.core.api.Assertions.assertThat;

import com.reportplatform.ppt.model.RenderFormat;
import com.reportplatform.ppt.model.RenderRequest;
import com.reportplatform.ppt.model.RenderResponse;
import com.reportplatform.ppt.model.DraftPreviewRequest;
import com.reportplatform.ppt.model.DraftPreviewHighlight;
import com.reportplatform.ppt.model.DraftPreviewValue;
import com.reportplatform.ppt.model.GenerateRequest;
import com.reportplatform.ppt.model.GenerateValue;
import com.reportplatform.ppt.model.StaticPreviewRequest;
import com.reportplatform.ppt.storage.StoragePathResolver;
import com.reportplatform.ppt.storage.StorageProperties;
import java.awt.geom.Rectangle2D;
import java.io.IOException;
import java.io.ByteArrayInputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.concurrent.TimeUnit;
import javax.imageio.ImageIO;
import org.apache.poi.xslf.usermodel.XMLSlideShow;
import org.apache.poi.xslf.usermodel.XSLFSlide;
import org.apache.poi.xslf.usermodel.XSLFTextBox;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.io.TempDir;

class PptRenderServiceTest {

    @TempDir
    Path storageRoot;

    @Test
    void rendersEverySlideToPng() throws Exception {
        String templateId = "42c78fd1-4c8d-48af-94d7-ed0d874e9c40";
        Path templatePath = storageRoot.resolve("templates").resolve(templateId).resolve("fixture.pptx");
        Files.createDirectories(templatePath.getParent());
        createFixture(templatePath);

        String executable = System.getenv().getOrDefault("LIBREOFFICE_EXECUTABLE", "soffice");
        Assumptions.assumeTrue(isExecutableAvailable(executable), "LibreOffice is unavailable");
        PptRenderService service = new PptRenderService(
                new StoragePathResolver(new StorageProperties(storageRoot)),
                executable);
        RenderResponse response = service.render(new RenderRequest(
                "file-1",
                templateId,
                "templates/" + templateId + "/fixture.pptx",
                sha256(templatePath),
                RenderFormat.PNG,
                "render-test"));

        assertThat(response.pageCount()).isEqualTo(2);
        assertThat(response.files()).hasSize(2);
        assertThat(response.files()).extracting(file -> file.slideIndex()).containsExactly(0, 1);
        for (var file : response.files()) {
            Path renderedPath = storageRoot.resolve(file.relativePath());
            assertThat(renderedPath).isRegularFile();
            assertThat(file.mimeType()).isEqualTo("image/png");
            assertThat(file.sha256()).hasSize(64);
            assertThat(ImageIO.read(renderedPath.toFile())).isNotNull();
        }
    }

    @Test
    void rendersStaticSlideWithoutMutatingTemplate() throws Exception {
        String templateId = "c2b38419-6237-43df-8911-b90b0ac6a3b6";
        Path templatePath = storageRoot.resolve("templates").resolve(templateId).resolve("fixture.pptx");
        Files.createDirectories(templatePath.getParent());
        createFixture(templatePath);
        String originalHash = sha256(templatePath);

        String executable = System.getenv().getOrDefault("LIBREOFFICE_EXECUTABLE", "soffice");
        Assumptions.assumeTrue(isExecutableAvailable(executable), "LibreOffice is unavailable");
        PptRenderService service = new PptRenderService(
                new StoragePathResolver(new StorageProperties(storageRoot)), executable);
        byte[] preview = service.renderStaticPreview(new StaticPreviewRequest(
                "templates/" + templateId + "/fixture.pptx", originalHash, 1));

        assertThat(preview.length).isGreaterThan(1000);
        assertThat(sha256(templatePath)).isEqualTo(originalHash);
    }

    @Test
    void rendersFilledDraftWithoutMutatingTemplate() throws Exception {
        String templateId = "d0d448d4-6c31-467e-9482-0df07baa7128";
        Path templatePath = storageRoot.resolve("templates").resolve(templateId).resolve("fixture.pptx");
        Files.createDirectories(templatePath.getParent());
        createFixture(templatePath);
        String originalHash = sha256(templatePath);
        String executable = System.getenv().getOrDefault("LIBREOFFICE_EXECUTABLE", "soffice");
        Assumptions.assumeTrue(isExecutableAvailable(executable), "LibreOffice is unavailable");
        PptRenderService service = new PptRenderService(
                new StoragePathResolver(new StorageProperties(storageRoot)), executable);
        byte[] preview = service.renderDraftPreview(new DraftPreviewRequest(
                "templates/" + templateId + "/fixture.pptx", originalHash, 0,
                List.of(new DraftPreviewValue("report_month", 0, "2026-09"))));

        assertThat(preview.length).isGreaterThan(1000);
        assertThat(sha256(templatePath)).isEqualTo(originalHash);
    }

    @Test
    void highlightsSelectedTextInRenderedDraft() throws Exception {
        String templateId = "b199daab-3f0e-4a20-9042-b5cfa3b07ab3";
        Path templatePath = storageRoot.resolve("templates").resolve(templateId).resolve("fixture.pptx");
        Files.createDirectories(templatePath.getParent());
        createFixture(templatePath);
        String originalHash = sha256(templatePath);
        String executable = System.getenv().getOrDefault("LIBREOFFICE_EXECUTABLE", "soffice");
        Assumptions.assumeTrue(isExecutableAvailable(executable), "LibreOffice is unavailable");
        PptRenderService service = new PptRenderService(
                new StoragePathResolver(new StorageProperties(storageRoot)), executable);

        byte[] preview = service.renderDraftPreview(new DraftPreviewRequest(
                "templates/" + templateId + "/fixture.pptx", originalHash, 0,
                List.of(new DraftPreviewValue("report_month", 0, "2026-09")),
                new DraftPreviewHighlight("report_month", 0)));
        var image = ImageIO.read(new ByteArrayInputStream(preview));
        boolean hasMagentaText = false;
        for (int y = 0; y < image.getHeight() && !hasMagentaText; y++) {
            for (int x = 0; x < image.getWidth(); x++) {
                int rgb = image.getRGB(x, y);
                if (((rgb >> 16) & 0xff) > 130 && ((rgb >> 8) & 0xff) < 90 && (rgb & 0xff) > 50) {
                    hasMagentaText = true;
                    break;
                }
            }
        }
        assertThat(hasMagentaText).isTrue();
        assertThat(sha256(templatePath)).isEqualTo(originalHash);
    }

    @Test
    void generatesPptxPdfAndEveryPagePngWithoutMutatingTemplate() throws Exception {
        String templateId = "25bdf113-d89f-4f8c-a02b-8394a6becc0d";
        String generationId = "bd03a11b-6026-48c1-aa02-4666d6d4ee19";
        Path templatePath = storageRoot.resolve("templates").resolve(templateId).resolve("fixture.pptx");
        Files.createDirectories(templatePath.getParent());
        createFixture(templatePath);
        String originalHash = sha256(templatePath);
        String executable = System.getenv().getOrDefault("LIBREOFFICE_EXECUTABLE", "soffice");
        Assumptions.assumeTrue(isExecutableAvailable(executable), "LibreOffice is unavailable");
        PptRenderService service = new PptRenderService(
                new StoragePathResolver(new StorageProperties(storageRoot)), executable);
        var result = service.generate(new GenerateRequest(
                "templates/" + templateId + "/fixture.pptx", originalHash, generationId,
                List.of(new GenerateValue(0, "report_month", 0, "2026-09"))));

        assertThat(result.pageCount()).isEqualTo(2);
        assertThat(result.files()).extracting(file -> file.type()).containsExactly("PPTX", "PDF", "PNG", "PNG");
        for (var file : result.files()) {
            Path output = storageRoot.resolve(file.relativePath());
            assertThat(output).isRegularFile();
            assertThat(file.sha256()).isEqualTo(sha256(output));
        }
        try (XMLSlideShow generated = new XMLSlideShow(Files.newInputStream(storageRoot.resolve(result.files().get(0).relativePath())))) {
            assertThat(((XSLFTextBox) generated.getSlides().get(0).getShapes().get(0)).getText())
                    .contains("2026-09").doesNotContain("{{report_month}}");
        }
        assertThat(sha256(templatePath)).isEqualTo(originalHash);
    }

    private void createFixture(Path outputPath) throws IOException {
        try (XMLSlideShow slideShow = new XMLSlideShow()) {
            XSLFSlide firstSlide = slideShow.createSlide();
            XSLFTextBox textBox = firstSlide.createTextBox();
            textBox.setAnchor(new Rectangle2D.Double(40, 50, 600, 100));
            textBox.setText("模板预览 {{report_month}}");
            slideShow.createSlide().createTextBox().setText("第二页");
            try (OutputStream outputStream = Files.newOutputStream(outputPath)) {
                slideShow.write(outputStream);
            }
        }
    }

    private String sha256(Path path) throws IOException, NoSuchAlgorithmException {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(path)));
    }

    private boolean isExecutableAvailable(String executable) {
        try {
            Process process = new ProcessBuilder(executable, "--version")
                    .redirectErrorStream(true)
                    .start();
            return process.waitFor(10, TimeUnit.SECONDS) && process.exitValue() == 0;
        } catch (IOException exception) {
            return false;
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return false;
        }
    }
}
