package com.reportplatform.ppt.model;

public record PlaceholderMetadata(
        String key,
        int occurrenceIndex,
        int shapeId,
        String shapeName,
        String shapeType,
        String containerType,
        int paragraphIndex,
        int startRunIndex,
        int startOffset,
        int endRunIndex,
        int endOffset,
        Integer tableRow,
        Integer tableColumn,
        String originalText,
        GeometryMetadata geometry,
        TextStyleMetadata style) {
}

