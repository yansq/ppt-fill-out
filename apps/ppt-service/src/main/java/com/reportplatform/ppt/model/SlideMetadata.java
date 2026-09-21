package com.reportplatform.ppt.model;

import java.util.List;

public record SlideMetadata(
        int slideIndex,
        long widthEmu,
        long heightEmu,
        List<ShapeMetadata> shapes,
        List<PlaceholderMetadata> placeholders) {
}

