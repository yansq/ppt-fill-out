package com.reportplatform.ppt.parser;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.reportplatform.ppt.storage.StoragePathResolver;
import com.reportplatform.ppt.storage.StorageProperties;
import java.io.ByteArrayInputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import org.apache.poi.xslf.usermodel.XMLSlideShow;
import org.apache.poi.xslf.usermodel.XSLFTextRun;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class SampleTemplateServiceTest {
    @TempDir Path root;

    @Test
    void replacesExactTextAcrossRunsAndLeavesOtherText() throws Exception {
        Path path = root.resolve("templates/sample/sample.pptx");
        Files.createDirectories(path.getParent());
        try (XMLSlideShow show = new XMLSlideShow()) {
            var paragraph = show.createSlide().createTextBox().addNewTextParagraph();
            XSLFTextRun first = paragraph.addNewTextRun();
            first.setText("产量为 12");
            XSLFTextRun second = paragraph.addNewTextRun();
            second.setText("34 吨，完成率 95%");
            try (var stream = Files.newOutputStream(path)) { show.write(stream); }
        }
        byte[] source = Files.readAllBytes(path);
        String sha = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(source));
        SampleTemplateService service = new SampleTemplateService(new StoragePathResolver(new StorageProperties(root)));
        var input = new SampleTemplateService.Source("templates/sample/sample.pptx", sha);
        var segment = service.inspect(input).get(0);
        assertEquals("产量为 1234 吨，完成率 95%", segment.text());
        byte[] output = service.apply(new SampleTemplateService.ApplyRequest(input.relativePath(), sha, List.of(
                new SampleTemplateService.Replacement(segment, "1234", "production"),
                new SampleTemplateService.Replacement(segment, "95%", "completion_rate"))));
        try (XMLSlideShow show = new XMLSlideShow(new ByteArrayInputStream(output))) {
            var box = (org.apache.poi.xslf.usermodel.XSLFTextShape) show.getSlides().get(0).getShapes().get(0);
            assertEquals("产量为 {{production}} 吨，完成率 {{completion_rate}}", box.getText());
        }
        Path generatedPath = root.resolve("templates/generated/template.pptx");
        Files.createDirectories(generatedPath.getParent());
        Files.write(generatedPath, output);
        String generatedSha = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(output));
        var parsed = new PptParserService(new StoragePathResolver(new StorageProperties(root)))
                .parse(new com.reportplatform.ppt.model.ParseRequest("generated", "templates/generated/template.pptx", generatedSha));
        assertEquals(2, parsed.slides().get(0).placeholders().size());
        assertThrows(IllegalArgumentException.class, () -> service.apply(new SampleTemplateService.ApplyRequest(input.relativePath(), sha,
                List.of(new SampleTemplateService.Replacement(segment, "不存在", "missing")))));
    }
}
