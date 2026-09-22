package com.reportplatform.ppt.renderer;

import static org.assertj.core.api.Assertions.assertThat;

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
}
