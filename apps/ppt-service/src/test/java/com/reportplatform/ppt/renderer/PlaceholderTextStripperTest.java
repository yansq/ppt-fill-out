package com.reportplatform.ppt.renderer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.reportplatform.ppt.model.DraftPreviewValue;
import com.reportplatform.ppt.model.GenerateValue;
import java.util.List;
import org.apache.poi.xslf.usermodel.XMLSlideShow;
import org.apache.poi.xslf.usermodel.XSLFTable;
import org.apache.poi.xslf.usermodel.XSLFTextBox;
import org.apache.poi.xslf.usermodel.XSLFTextParagraph;
import org.junit.jupiter.api.Test;

class PlaceholderTextStripperTest {

    @Test
    void removesCrossRunAndTableTokensWithoutTouchingSurroundingTextOrOriginal() throws Exception {
        try (XMLSlideShow show = new XMLSlideShow()) {
            var slide = show.createSlide();
            XSLFTextBox box = slide.createTextBox();
            XSLFTextParagraph paragraph = box.addNewTextParagraph();
            paragraph.addNewTextRun().setText("固定前缀 {{report_");
            paragraph.addNewTextRun().setText("month}} 和 {{count}} 固定后缀");
            XSLFTable table = slide.createTable(1, 1);
            table.getCell(0, 0).setText("合计 {{total}} 元");
            XSLFTextBox unchanged = slide.createTextBox();
            unchanged.setText("普通文字 {not_a_token}");

            PlaceholderTextStripper.strip(show);

            assertThat(box.getText()).isEqualTo("固定前缀  和  固定后缀");
            assertThat(table.getCell(0, 0).getText()).isEqualTo("合计  元");
            assertThat(unchanged.getText()).isEqualTo("普通文字 {not_a_token}");
        }
    }

    @Test
    void insertsEachOccurrenceInsideItsOriginalParagraphAndKeepsSurroundingText() throws Exception {
        try (XMLSlideShow show = new XMLSlideShow()) {
            var slide = show.createSlide();
            XSLFTextBox box = slide.createTextBox();
            XSLFTextParagraph paragraph = box.addNewTextParagraph();
            paragraph.addNewTextRun().setText("前文 {{acc");
            paragraph.addNewTextRun().setText("uracy}}，中间 {{accuracy}}，后文");
            XSLFTable table = slide.createTable(1, 1);
            table.getCell(0, 0).setText("表格 {{count}} 个");

            PlaceholderTextStripper.fill(show, 0, List.of(
                    new DraftPreviewValue("accuracy", 0, "95%"),
                    new DraftPreviewValue("accuracy", 1, "96%"),
                    new DraftPreviewValue("count", 0, "12")));

            assertThat(box.getText()).isEqualTo("前文 95%，中间 96%，后文");
            assertThat(table.getCell(0, 0).getText()).isEqualTo("表格 12 个");
            assertThat(paragraph.getTextRuns().get(0).getRawText()).contains("95%");
        }
    }

    @Test
    void rejectsReplacementForAbsentOccurrence() throws Exception {
        try (XMLSlideShow show = new XMLSlideShow()) {
            show.createSlide().createTextBox().setText("{{accuracy}}");
            assertThatThrownBy(() -> PlaceholderTextStripper.fill(show, 0,
                    List.of(new DraftPreviewValue("accuracy", 1, "missing"))))
                    .isInstanceOf(PptRenderException.class);
        }
    }

    @Test
    void fullGenerationRequiresEveryOccurrenceOnEverySlide() throws Exception {
        try (XMLSlideShow show = new XMLSlideShow()) {
            show.createSlide().createTextBox().setText("甲 {{key}} 乙 {{key}}");
            show.createSlide().createTextBox().setText("表述 {{other}}");
            assertThatThrownBy(() -> PlaceholderTextStripper.fillAll(show,
                    List.of(new GenerateValue(0, "key", 0, "一"))))
                    .isInstanceOf(PptRenderException.class)
                    .hasMessageContaining("do not cover");
        }
        try (XMLSlideShow show = new XMLSlideShow()) {
            show.createSlide().createTextBox().setText("甲 {{key}} 乙 {{key}}");
            show.createSlide().createTextBox().setText("表述 {{other}}");
            PlaceholderTextStripper.fillAll(show, List.of(
                    new GenerateValue(0, "key", 0, "一"),
                    new GenerateValue(0, "key", 1, "二"),
                    new GenerateValue(1, "other", 0, "三")));
            assertThat(show.getSlides().get(0).getShapes().get(0)).isInstanceOf(XSLFTextBox.class);
            assertThat(((XSLFTextBox) show.getSlides().get(0).getShapes().get(0)).getText()).isEqualTo("甲 一 乙 二");
        }
    }
}
