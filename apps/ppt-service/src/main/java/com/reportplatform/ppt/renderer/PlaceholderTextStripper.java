package com.reportplatform.ppt.renderer;

import com.reportplatform.ppt.model.DraftPreviewValue;
import com.reportplatform.ppt.model.DraftPreviewHighlight;
import com.reportplatform.ppt.model.GenerateValue;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.HashSet;
import java.util.Set;
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
import org.openxmlformats.schemas.drawingml.x2006.main.CTRegularTextRun;
import org.openxmlformats.schemas.drawingml.x2006.main.CTTextParagraph;

final class PlaceholderTextStripper {

    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\{([A-Za-z_][A-Za-z0-9_.-]*)}}", Pattern.UNICODE_CASE);

    private PlaceholderTextStripper() {
    }

    static void strip(XMLSlideShow show) {
        for (XSLFSlide slide : show.getSlides()) {
            replace(slide, Map.of());
        }
    }

    static void fill(XMLSlideShow show, int slideIndex, List<DraftPreviewValue> values) {
        fill(show, slideIndex, values, null);
    }

    static void fill(XMLSlideShow show, int slideIndex, List<DraftPreviewValue> values, DraftPreviewHighlight highlight) {
        Map<String, String> replacements = new HashMap<>();
        for (DraftPreviewValue value : values) {
            if (replacements.putIfAbsent(tokenKey(value.key(), value.occurrenceIndex()), value.valueText()) != null) {
                throw new PptRenderException("Duplicate draft preview value");
            }
        }
        String highlightKey = highlight == null ? null : tokenKey(highlight.key(), highlight.occurrenceIndex());
        if (highlightKey != null && !replacements.containsKey(highlightKey)) {
            throw new PptRenderException("Highlighted placeholder does not match draft preview values");
        }
        if (highlightKey != null && replacements.get(highlightKey).isBlank()) {
            replacements.put(highlightKey, "{{" + highlight.key() + "}}");
        }
        ReplacementResult result = replace(show.getSlides().get(slideIndex), replacements, highlightKey);
        if (!result.consumed().containsAll(replacements.keySet())) {
            throw new PptRenderException("Draft preview value does not match template placeholder");
        }
    }

    static void fillAll(XMLSlideShow show, List<GenerateValue> values) {
        Map<Integer, Map<String, String>> bySlide = new HashMap<>();
        for (GenerateValue value : values) {
            if (value.slideIndex() >= show.getSlides().size()) {
                throw new PptRenderException("Generated value refers to an absent slide");
            }
            Map<String, String> replacements = bySlide.computeIfAbsent(value.slideIndex(), ignored -> new HashMap<>());
            if (replacements.putIfAbsent(tokenKey(value.key(), value.occurrenceIndex()), value.valueText()) != null) {
                throw new PptRenderException("Duplicate generated value");
            }
        }
        for (int slideIndex = 0; slideIndex < show.getSlides().size(); slideIndex++) {
            Map<String, String> replacements = bySlide.getOrDefault(slideIndex, Map.of());
            ReplacementResult result = replace(show.getSlides().get(slideIndex), replacements);
            if (!result.found().equals(replacements.keySet())) {
                throw new PptRenderException("Generated values do not cover the template placeholders on slide " + (slideIndex + 1));
            }
        }
    }

    private static ReplacementResult replace(XSLFSlide slide, Map<String, String> replacements) {
        return replace(slide, replacements, null);
    }

    private static ReplacementResult replace(XSLFSlide slide, Map<String, String> replacements, String highlightKey) {
        Map<String, Integer> occurrences = new HashMap<>();
        Set<String> consumed = new HashSet<>();
        Set<String> found = new HashSet<>();
        for (XSLFShape shape : slide.getShapes()) {
            if (shape instanceof XSLFTable table) {
                for (int row = 0; row < table.getNumberOfRows(); row++) {
                    for (int column = 0; column < table.getNumberOfColumns(); column++) {
                        XSLFTableCell cell = table.getCell(row, column);
                        if (cell != null) replace(cell, replacements, occurrences, consumed, found, highlightKey);
                    }
                }
            } else if (shape instanceof XSLFTextShape textShape) {
                replace(textShape, replacements, occurrences, consumed, found, highlightKey);
            }
        }
        return new ReplacementResult(consumed, found);
    }

    private static String tokenKey(String key, int occurrenceIndex) {
        return key + "#" + occurrenceIndex;
    }

    private static void replace(
            XSLFTextShape shape,
            Map<String, String> replacements,
            Map<String, Integer> occurrences,
            Set<String> consumed,
            Set<String> found,
            String highlightKey) {
        for (XSLFTextParagraph paragraph : shape.getTextParagraphs()) {
            List<XSLFTextRun> runs = paragraph.getTextRuns();
            StringBuilder fullText = new StringBuilder();
            for (XSLFTextRun run : runs) {
                String text = run.getRawText();
                if (text != null) fullText.append(text);
            }
            boolean[] remove = new boolean[fullText.length()];
            Map<Integer, String> insertions = new HashMap<>();
            Set<Integer> highlightedInsertions = new HashSet<>();
            Matcher matcher = PLACEHOLDER.matcher(fullText);
            while (matcher.find()) {
                String key = matcher.group(1);
                String occurrenceKey = tokenKey(key, occurrences.merge(key, 1, Integer::sum) - 1);
                found.add(occurrenceKey);
                if (replacements.containsKey(occurrenceKey)) {
                    insertions.put(matcher.start(), replacements.get(occurrenceKey));
                    consumed.add(occurrenceKey);
                    if (occurrenceKey.equals(highlightKey)) highlightedInsertions.add(matcher.start());
                }
                for (int index = matcher.start(); index < matcher.end(); index++) remove[index] = true;
            }
            int globalIndex = 0;
            XSLFTextRun selectedRun = null;
            int selectedStart = -1;
            int selectedEnd = -1;
            for (XSLFTextRun run : runs) {
                String text = run.getRawText();
                if (text == null) continue;
                StringBuilder kept = new StringBuilder();
                for (int index = 0; index < text.length(); index++) {
                    String insertion = insertions.get(globalIndex);
                    if (insertion != null) {
                        if (highlightedInsertions.contains(globalIndex)) {
                            selectedRun = run;
                            selectedStart = kept.length();
                            selectedEnd = selectedStart + insertion.length();
                        }
                        kept.append(insertion);
                    }
                    if (!remove[globalIndex++]) kept.append(text.charAt(index));
                }
                if (!kept.toString().equals(text)) run.setText(kept.toString());
            }
            if (selectedRun != null) colorSelectedText(paragraph, selectedRun, selectedStart, selectedEnd);
        }
    }

    private static void colorSelectedText(XSLFTextParagraph paragraph, XSLFTextRun run, int start, int end) {
        if (!(run.getXmlObject() instanceof CTRegularTextRun original)) {
            throw new PptRenderException("Cannot highlight this placeholder text run");
        }
        CTTextParagraph xmlParagraph = paragraph.getXmlObject();
        int runIndex = -1;
        for (int index = 0; index < xmlParagraph.sizeOfRArray(); index++) {
            if (xmlParagraph.getRArray(index).getDomNode().isSameNode(original.getDomNode())) {
                runIndex = index;
                break;
            }
        }
        if (runIndex < 0) throw new PptRenderException("Cannot find highlighted placeholder text run");
        String fullText = original.getT();
        CTRegularTextRun style = (CTRegularTextRun) original.copy();
        original.setT(fullText.substring(0, start));
        CTRegularTextRun marked = xmlParagraph.insertNewR(runIndex + 1);
        marked.set(style);
        marked.setT(fullText.substring(start, end));
        var properties = marked.isSetRPr() ? marked.getRPr() : marked.addNewRPr();
        if (properties.isSetSolidFill()) properties.unsetSolidFill();
        properties.addNewSolidFill().addNewSrgbClr().setVal(new byte[] {(byte) 0xD6, 0, (byte) 0x78});
        if (end < fullText.length()) {
            CTRegularTextRun suffix = xmlParagraph.insertNewR(runIndex + 2);
            suffix.set(style);
            suffix.setT(fullText.substring(end));
        }
    }

    private record ReplacementResult(Set<String> consumed, Set<String> found) {
    }
}
