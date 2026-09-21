package com.reportplatform.ppt.parser;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.reportplatform.ppt.model.ParseRequest;
import com.reportplatform.ppt.model.ParseResponse;
import com.reportplatform.ppt.model.PlaceholderMetadata;
import com.reportplatform.ppt.storage.StoragePathResolver;
import com.reportplatform.ppt.storage.StorageProperties;
import java.awt.Color;
import java.awt.geom.Rectangle2D;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import org.apache.poi.xslf.usermodel.XMLSlideShow;
import org.apache.poi.xslf.usermodel.XSLFSlide;
import org.apache.poi.xslf.usermodel.XSLFTable;
import org.apache.poi.xslf.usermodel.XSLFTextBox;
import org.apache.poi.xslf.usermodel.XSLFTextParagraph;
import org.apache.poi.xslf.usermodel.XSLFTextRun;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class PptParserServiceTest {

    @TempDir
    Path storageRoot;

    private PptParserService parserService;
    private Path templatePath;
    private String sha256;

    @BeforeEach
    void setUp() throws Exception {
        Files.createDirectories(storageRoot.resolve("templates/template-1"));
        templatePath = storageRoot.resolve("templates/template-1/template.pptx");
        createFixture(templatePath);
        sha256 = sha256(templatePath);
        parserService = new PptParserService(new StoragePathResolver(new StorageProperties(storageRoot)));
    }

    @Test
    void parsesSingleRunCrossRunRepeatedAndTablePlaceholders() {
        ParseResponse response = parserService.parse(new ParseRequest(
                "file-1",
                "templates/template-1/template.pptx",
                sha256));

        assertThat(response.parserVersion()).isEqualTo("1.0.0");
        assertThat(response.slides()).hasSize(2);
        assertThat(response.widthEmu()).isPositive();
        assertThat(response.heightEmu()).isPositive();

        List<PlaceholderMetadata> placeholders = response.slides().get(0).placeholders();
        assertThat(placeholders).extracting(PlaceholderMetadata::key)
                .containsExactly("report_month", "people_number", "people_number", "score");
        assertThat(placeholders).extracting(PlaceholderMetadata::occurrenceIndex)
                .containsExactly(0, 0, 1, 0);

        PlaceholderMetadata crossRun = placeholders.get(0);
        assertThat(crossRun.startRunIndex()).isEqualTo(0);
        assertThat(crossRun.endRunIndex()).isEqualTo(1);
        assertThat(crossRun.style().fontFamily()).isEqualTo("Arial");
        assertThat(crossRun.style().bold()).isTrue();
        assertThat(crossRun.style().fontColor()).isEqualTo("#1F4E79");
        assertThat(crossRun.geometry().widthEmu()).isPositive();

        PlaceholderMetadata tablePlaceholder = placeholders.get(3);
        assertThat(tablePlaceholder.containerType()).isEqualTo("TABLE_CELL");
        assertThat(tablePlaceholder.tableRow()).isZero();
        assertThat(tablePlaceholder.tableColumn()).isZero();
        assertThat(response.warnings()).containsExactly("Slide 2 contains no business placeholders");
    }

    @Test
    void rejectsHashMismatch() {
        assertThatThrownBy(() -> parserService.parse(new ParseRequest(
                        "file-1",
                        "templates/template-1/template.pptx",
                        "0".repeat(64))))
                .isInstanceOf(PptParseException.class)
                .hasMessage("Template file hash does not match request");
    }

    @Test
    void rejectsPathsOutsideTemplatesDirectory() {
        assertThatThrownBy(() -> parserService.parse(new ParseRequest(
                        "file-1",
                        "../template.pptx",
                        sha256)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("templates directory");
    }

    private void createFixture(Path outputPath) throws IOException {
        try (XMLSlideShow slideShow = new XMLSlideShow()) {
            XSLFSlide slide = slideShow.createSlide();

            XSLFTextBox textBox = slide.createTextBox();
            textBox.setAnchor(new Rectangle2D.Double(40, 50, 600, 100));
            XSLFTextParagraph paragraph = textBox.addNewTextParagraph();
            XSLFTextRun firstRun = paragraph.addNewTextRun();
            firstRun.setText("截至{{report_");
            firstRun.setFontFamily("Arial");
            firstRun.setFontSize(20.0);
            firstRun.setBold(true);
            firstRun.setFontColor(new Color(0x1F, 0x4E, 0x79));
            XSLFTextRun secondRun = paragraph.addNewTextRun();
            secondRun.setText("month}}月，共{{people_number}}人");
            secondRun.setFontFamily("Calibri");

            XSLFTextBox repeated = slide.createTextBox();
            repeated.setAnchor(new Rectangle2D.Double(40, 170, 400, 60));
            repeated.setText("重复指标：{{people_number}}");

            XSLFTable table = slide.createTable(2, 2);
            table.setAnchor(new Rectangle2D.Double(40, 260, 600, 180));
            table.getCell(0, 0).setText("综合评分：{{score}}");
            table.getCell(0, 1).setText("固定内容");
            table.getCell(1, 0).setText("无占位符");
            table.getCell(1, 1).setText("完成");

            slideShow.createSlide().createTextBox().setText("固定封底");

            try (OutputStream outputStream = Files.newOutputStream(outputPath)) {
                slideShow.write(outputStream);
            }
        }
    }

    private String sha256(Path path) throws IOException, NoSuchAlgorithmException {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(path)));
    }
}
