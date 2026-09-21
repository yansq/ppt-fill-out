package com.reportplatform.ppt.renderer;

import static org.assertj.core.api.Assertions.assertThat;

import com.reportplatform.ppt.model.RenderFormat;
import com.reportplatform.ppt.model.RenderRequest;
import com.reportplatform.ppt.model.RenderResponse;
import com.reportplatform.ppt.storage.StoragePathResolver;
import com.reportplatform.ppt.storage.StorageProperties;
import java.awt.geom.Rectangle2D;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
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
