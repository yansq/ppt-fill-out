package com.reportplatform.ppt.model;

public record ShapeMetadata(
        int shapeId,
        String shapeName,
        String shapeType,
        GeometryMetadata geometry,
        String text) {
}

