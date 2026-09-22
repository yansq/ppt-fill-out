package com.reportplatform.ppt.renderer;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.apache.poi.xslf.usermodel.XMLSlideShow;
import org.apache.poi.xslf.usermodel.XSLFShape;
import org.apache.poi.xslf.usermodel.XSLFSlide;
import org.apache.poi.xslf.usermodel.XSLFTable;
import org.apache.poi.xslf.usermodel.XSLFTableCell;
import org.apache.poi.xslf.usermodel.XSLFTextParagraph;
import org.apache.poi.xslf.usermodel.XSLFTextRun;
import org.apache.poi.xslf.usermodel.XSLFTextShape;

final class PlaceholderTextStripper {

    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\{([A-Za-z_][A-Za-z0-9_.-]*)}}", Pattern.UNICODE_CASE);

    private PlaceholderTextStripper() {
    }

    static void strip(XMLSlideShow show) {
        for (XSLFSlide slide : show.getSlides()) {
            for (XSLFShape shape : slide.getShapes()) {
                if (shape instanceof XSLFTable table) {
                    for (int row = 0; row < table.getNumberOfRows(); row++) {
                        for (int column = 0; column < table.getNumberOfColumns(); column++) {
                            XSLFTableCell cell = table.getCell(row, column);
                            if (cell != null) strip(cell);
                        }
                    }
                } else if (shape instanceof XSLFTextShape textShape) {
                    strip(textShape);
                }
            }
        }
    }

    private static void strip(XSLFTextShape shape) {
        for (XSLFTextParagraph paragraph : shape.getTextParagraphs()) {
            List<XSLFTextRun> runs = paragraph.getTextRuns();
            StringBuilder fullText = new StringBuilder();
            for (XSLFTextRun run : runs) {
                String text = run.getRawText();
                if (text != null) fullText.append(text);
            }
            boolean[] remove = new boolean[fullText.length()];
            Matcher matcher = PLACEHOLDER.matcher(fullText);
            while (matcher.find()) {
                for (int index = matcher.start(); index < matcher.end(); index++) remove[index] = true;
            }
            int globalIndex = 0;
            for (XSLFTextRun run : runs) {
                String text = run.getRawText();
                if (text == null) continue;
                StringBuilder kept = new StringBuilder();
                for (int index = 0; index < text.length(); index++) {
                    if (!remove[globalIndex++]) kept.append(text.charAt(index));
                }
                if (kept.length() != text.length()) run.setText(kept.toString());
            }
        }
    }
}
