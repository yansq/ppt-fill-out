package com.reportplatform.ppt.parser;

import com.reportplatform.ppt.model.GeometryMetadata;
import com.reportplatform.ppt.model.ParseRequest;
import com.reportplatform.ppt.model.ParseResponse;
import com.reportplatform.ppt.model.PlaceholderMetadata;
import com.reportplatform.ppt.model.ShapeMetadata;
import com.reportplatform.ppt.model.SlideMetadata;
import com.reportplatform.ppt.model.TextStyleMetadata;
import com.reportplatform.ppt.storage.StoragePathResolver;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.geom.Rectangle2D;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.apache.poi.sl.draw.DrawPaint;
import org.apache.poi.sl.usermodel.PaintStyle;
import org.apache.poi.util.Units;
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
public class PptParserService {

    public static final String PARSER_VERSION = "1.0.0";
    private static final Pattern PLACEHOLDER_PATTERN = Pattern.compile("\\{\\{([A-Za-z_][A-Za-z0-9_.-]*)}}", Pattern.UNICODE_CASE);

    private final StoragePathResolver pathResolver;

    public PptParserService(StoragePathResolver pathResolver) {
        this.pathResolver = pathResolver;
    }

    public ParseResponse parse(ParseRequest request) {
        Path path = pathResolver.resolveTemplate(request.relativePath());
        if (!Files.isRegularFile(path) || !Files.isReadable(path)) {
            throw new PptParseException("Template file is not available");
        }
        verifyHash(path, request.sha256());

        try (InputStream inputStream = Files.newInputStream(path);
                XMLSlideShow slideShow = new XMLSlideShow(inputStream)) {
            Dimension pageSize = slideShow.getPageSize();
            long widthEmu = Units.toEMU(pageSize.getWidth());
            long heightEmu = Units.toEMU(pageSize.getHeight());
            List<SlideMetadata> slides = new ArrayList<>();
            List<String> warnings = new ArrayList<>();

            for (int slideIndex = 0; slideIndex < slideShow.getSlides().size(); slideIndex++) {
                slides.add(parseSlide(slideShow.getSlides().get(slideIndex), slideIndex, widthEmu, heightEmu, warnings));
            }

            return new ParseResponse(request.fileId(), PARSER_VERSION, widthEmu, heightEmu, slides, warnings);
        } catch (IOException | RuntimeException exception) {
            if (exception instanceof PptParseException pptParseException) {
                throw pptParseException;
            }
            throw new PptParseException("Unable to parse PPTX template", exception);
        }
    }

    private SlideMetadata parseSlide(
            XSLFSlide slide,
            int slideIndex,
            long widthEmu,
            long heightEmu,
            List<String> warnings) {
        List<ShapeMetadata> shapes = new ArrayList<>();
        List<PlaceholderMetadata> placeholders = new ArrayList<>();
        Map<String, Integer> occurrencesByKey = new HashMap<>();

        for (XSLFShape shape : slide.getShapes()) {
            GeometryMetadata geometry = geometry(shape.getAnchor());
            String text = shape instanceof XSLFTextShape textShape ? textShape.getText() : null;
            shapes.add(new ShapeMetadata(
                    shape.getShapeId(),
                    shape.getShapeName(),
                    shape.getClass().getSimpleName(),
                    geometry,
                    text));

            if (shape instanceof XSLFTable table) {
                for (int row = 0; row < table.getNumberOfRows(); row++) {
                    for (int column = 0; column < table.getNumberOfColumns(); column++) {
                        XSLFTableCell cell = table.getCell(row, column);
                        if (cell != null) {
                            parseTextContainer(
                                    cell,
                                    shape,
                                    "TABLE_CELL",
                                    row,
                                    column,
                                    geometry(cell.getAnchor()),
                                    occurrencesByKey,
                                    placeholders);
                        }
                    }
                }
            } else if (shape instanceof XSLFTextShape textShape) {
                parseTextContainer(
                        textShape,
                        shape,
                        "TEXT_SHAPE",
                        null,
                        null,
                        geometry,
                        occurrencesByKey,
                        placeholders);
            }
        }

        if (placeholders.isEmpty()) {
            warnings.add("Slide " + (slideIndex + 1) + " contains no business placeholders");
        }
        return new SlideMetadata(slideIndex, widthEmu, heightEmu, shapes, placeholders);
    }

    private void parseTextContainer(
            XSLFTextShape textShape,
            XSLFShape ownerShape,
            String containerType,
            Integer tableRow,
            Integer tableColumn,
            GeometryMetadata geometry,
            Map<String, Integer> occurrencesByKey,
            List<PlaceholderMetadata> placeholders) {
        List<XSLFTextParagraph> paragraphs = textShape.getTextParagraphs();
        for (int paragraphIndex = 0; paragraphIndex < paragraphs.size(); paragraphIndex++) {
            XSLFTextParagraph paragraph = paragraphs.get(paragraphIndex);
            RunTextMap runTextMap = RunTextMap.from(paragraph.getTextRuns());
            Matcher matcher = PLACEHOLDER_PATTERN.matcher(runTextMap.text());

            while (matcher.find()) {
                String key = matcher.group(1);
                RunPosition start = runTextMap.positionAt(matcher.start());
                RunPosition end = runTextMap.positionAt(matcher.end() - 1);
                XSLFTextRun styleRun = paragraph.getTextRuns().get(start.runIndex());
                placeholders.add(new PlaceholderMetadata(
                        key,
                        occurrencesByKey.merge(key, 1, Integer::sum) - 1,
                        ownerShape.getShapeId(),
                        ownerShape.getShapeName(),
                        ownerShape.getClass().getSimpleName(),
                        containerType,
                        paragraphIndex,
                        start.runIndex(),
                        start.offset(),
                        end.runIndex(),
                        end.offset() + 1,
                        tableRow,
                        tableColumn,
                        paragraph.getText(),
                        geometry,
                        style(styleRun, paragraph)));
            }
        }
    }

    private TextStyleMetadata style(XSLFTextRun run, XSLFTextParagraph paragraph) {
        String fontColor = null;
        PaintStyle paintStyle = run.getFontColor();
        if (paintStyle instanceof PaintStyle.SolidPaint solidPaint) {
            Color color = DrawPaint.applyColorTransform(solidPaint.getSolidColor());
            if (color != null) {
                fontColor = String.format(Locale.ROOT, "#%02X%02X%02X", color.getRed(), color.getGreen(), color.getBlue());
            }
        }
        return new TextStyleMetadata(
                run.getFontFamily(),
                run.getFontSize(),
                fontColor,
                run.isBold(),
                run.isItalic(),
                run.isUnderlined(),
                paragraph.getTextAlign() == null ? null : paragraph.getTextAlign().name(),
                paragraph.getLineSpacing());
    }

    private GeometryMetadata geometry(Rectangle2D anchor) {
        if (anchor == null) {
            return new GeometryMetadata(0, 0, 0, 0);
        }
        return new GeometryMetadata(
                Units.toEMU(anchor.getX()),
                Units.toEMU(anchor.getY()),
                Units.toEMU(anchor.getWidth()),
                Units.toEMU(anchor.getHeight()));
    }

    private void verifyHash(Path path, String expectedSha256) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (InputStream inputStream = new DigestInputStream(Files.newInputStream(path), digest)) {
                inputStream.transferTo(java.io.OutputStream.nullOutputStream());
            }
            String actualSha256 = HexFormat.of().formatHex(digest.digest());
            if (!MessageDigest.isEqual(
                    actualSha256.getBytes(java.nio.charset.StandardCharsets.US_ASCII),
                    expectedSha256.toLowerCase(Locale.ROOT).getBytes(java.nio.charset.StandardCharsets.US_ASCII))) {
                throw new PptParseException("Template file hash does not match request");
            }
        } catch (IOException | NoSuchAlgorithmException exception) {
            throw new PptParseException("Unable to verify template file hash", exception);
        }
    }

    private record RunPosition(int runIndex, int offset) {
    }

    private record CharacterPosition(int runIndex, int offset) {
    }

    private record RunTextMap(String text, List<CharacterPosition> positions) {

        static RunTextMap from(List<XSLFTextRun> runs) {
            StringBuilder text = new StringBuilder();
            List<CharacterPosition> positions = new ArrayList<>();
            for (int runIndex = 0; runIndex < runs.size(); runIndex++) {
                String rawText = runs.get(runIndex).getRawText();
                if (rawText == null) {
                    continue;
                }
                for (int offset = 0; offset < rawText.length(); offset++) {
                    text.append(rawText.charAt(offset));
                    positions.add(new CharacterPosition(runIndex, offset));
                }
            }
            return new RunTextMap(text.toString(), positions);
        }

        RunPosition positionAt(int logicalOffset) {
            if (logicalOffset < 0 || logicalOffset >= positions.size()) {
                throw new PptParseException("Placeholder character position is outside the text run map");
            }
            CharacterPosition position = positions.get(logicalOffset);
            return new RunPosition(position.runIndex(), position.offset());
        }
    }
}
