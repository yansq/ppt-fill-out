package com.reportplatform.ppt.parser;

import com.reportplatform.ppt.storage.StoragePathResolver;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import org.apache.poi.xslf.usermodel.XMLSlideShow;
import org.apache.poi.xslf.usermodel.XSLFShape;
import org.apache.poi.xslf.usermodel.XSLFSlide;
import org.apache.poi.xslf.usermodel.XSLFTable;
import org.apache.poi.xslf.usermodel.XSLFTableCell;
import org.apache.poi.xslf.usermodel.XSLFTextParagraph;
import org.apache.poi.xslf.usermodel.XSLFTextRun;
import org.apache.poi.xslf.usermodel.XSLFTextShape;
import org.springframework.stereotype.Service;

@Service
public class SampleTemplateService {
    private static final Pattern KEY = Pattern.compile("[A-Za-z_][A-Za-z0-9_.-]{0,79}");
    private final StoragePathResolver paths;

    public SampleTemplateService(StoragePathResolver paths) {
        this.paths = paths;
    }

    public record Source(String relativePath, String sha256) {}
    public record Segment(int slideIndex, int shapeId, Integer tableRow, Integer tableColumn, int paragraphIndex, String text) {}
    public record Replacement(Segment segment, String originalText, String key) {}
    public record ApplyRequest(String relativePath, String sha256, List<Replacement> replacements) {}

    public List<Segment> inspect(Source source) {
        try (XMLSlideShow show = open(source)) {
            return segments(show);
        } catch (Exception error) {
            if (error instanceof PptParseException failure) throw failure;
            throw new PptParseException("Unable to inspect sample PPTX", error);
        }
    }

    public byte[] apply(ApplyRequest request) {
        if (request.replacements() == null || request.replacements().isEmpty() || request.replacements().size() > 500) {
            throw new IllegalArgumentException("At least one and at most 500 replacements are required");
        }
        try (XMLSlideShow show = open(new Source(request.relativePath(), request.sha256()))) {
            List<Segment> segments = segments(show);
            for (Replacement replacement : request.replacements()) {
                if (replacement == null || replacement.segment() == null || replacement.originalText() == null
                        || replacement.originalText().isBlank() || replacement.key() == null || !KEY.matcher(replacement.key()).matches()) {
                    throw new IllegalArgumentException("Invalid template replacement");
                }
                if (!segments.contains(replacement.segment())) {
                    throw new IllegalArgumentException("Sample PPTX text changed; regenerate candidates");
                }
            }
            for (Segment segment : segments) {
                List<Replacement> selected = request.replacements().stream().filter(item -> item.segment().equals(segment)).toList();
                if (selected.isEmpty()) continue;
                XSLFTextParagraph paragraph = findParagraph(show.getSlides().get(segment.slideIndex()), segment);
                String original = segment.text();
                List<Range> ranges = new ArrayList<>();
                for (Replacement item : selected) {
                    int start = original.indexOf(item.originalText());
                    if (start < 0 || original.indexOf(item.originalText(), start + 1) >= 0) {
                        throw new IllegalArgumentException("Replacement text must occur exactly once in its paragraph");
                    }
                    ranges.add(new Range(start, start + item.originalText().length(), "{{" + item.key() + "}}"));
                }
                ranges.sort(Comparator.comparingInt(Range::start).reversed());
                int nextStart = original.length();
                for (Range range : ranges) {
                    if (range.end() > nextStart) throw new IllegalArgumentException("Replacement ranges overlap");
                    replaceRange(paragraph, range);
                    nextStart = range.start();
                }
            }
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            show.write(output);
            return output.toByteArray();
        } catch (PptParseException | IllegalArgumentException failure) {
            throw failure;
        } catch (Exception error) {
            throw new PptParseException("Unable to create template from sample", error);
        }
    }

    private XMLSlideShow open(Source source) {
        Path path = paths.resolveTemplate(source.relativePath());
        if (!Files.isRegularFile(path)) throw new PptParseException("Sample PPTX is unavailable");
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (InputStream input = new DigestInputStream(Files.newInputStream(path), digest)) {
                input.transferTo(java.io.OutputStream.nullOutputStream());
            }
            if (!HexFormat.of().formatHex(digest.digest()).equals(source.sha256().toLowerCase(Locale.ROOT))) {
                throw new PptParseException("Sample PPTX hash mismatch");
            }
            return new XMLSlideShow(Files.newInputStream(path));
        } catch (PptParseException failure) {
            throw failure;
        } catch (Exception error) {
            throw new PptParseException("Unable to open sample PPTX", error);
        }
    }

    private List<Segment> segments(XMLSlideShow show) {
        List<Segment> result = new ArrayList<>();
        for (int slideIndex = 0; slideIndex < show.getSlides().size(); slideIndex++) {
            for (XSLFShape shape : show.getSlides().get(slideIndex).getShapes()) {
                if (shape instanceof XSLFTable table) {
                    for (int row = 0; row < table.getNumberOfRows(); row++) {
                        for (int column = 0; column < table.getNumberOfColumns(); column++) {
                            XSLFTableCell cell = table.getCell(row, column);
                            if (cell != null) addParagraphs(result, slideIndex, shape.getShapeId(), row, column, cell);
                        }
                    }
                } else if (shape instanceof XSLFTextShape textShape) {
                    addParagraphs(result, slideIndex, shape.getShapeId(), null, null, textShape);
                }
            }
        }
        return result;
    }

    private void addParagraphs(List<Segment> result, int slide, int shape, Integer row, Integer column, XSLFTextShape textShape) {
        for (int index = 0; index < textShape.getTextParagraphs().size(); index++) {
            String text = textShape.getTextParagraphs().get(index).getText();
            if (text != null && !text.isBlank()) result.add(new Segment(slide, shape, row, column, index, text));
        }
    }

    private XSLFTextParagraph findParagraph(XSLFSlide slide, Segment segment) {
        for (XSLFShape shape : slide.getShapes()) {
            if (shape.getShapeId() != segment.shapeId()) continue;
            XSLFTextShape textShape;
            if (segment.tableRow() != null && segment.tableColumn() != null && shape instanceof XSLFTable table) {
                textShape = table.getCell(segment.tableRow(), segment.tableColumn());
            } else if (shape instanceof XSLFTextShape shapeText) {
                textShape = shapeText;
            } else break;
            return textShape.getTextParagraphs().get(segment.paragraphIndex());
        }
        throw new IllegalArgumentException("Replacement target is missing");
    }

    private void replaceRange(XSLFTextParagraph paragraph, Range range) {
        List<XSLFTextRun> runs = paragraph.getTextRuns();
        int cursor = 0;
        boolean inserted = false;
        for (XSLFTextRun run : runs) {
            String value = run.getRawText();
            if (value == null) value = "";
            int runStart = cursor;
            int runEnd = cursor + value.length();
            cursor = runEnd;
            if (runEnd <= range.start() || runStart >= range.end()) continue;
            int localStart = Math.max(0, range.start() - runStart);
            int localEnd = Math.min(value.length(), range.end() - runStart);
            String replacement = inserted ? "" : range.value();
            run.setText(value.substring(0, localStart) + replacement + value.substring(localEnd));
            inserted = true;
        }
    }

    private record Range(int start, int end, String value) {}
}
