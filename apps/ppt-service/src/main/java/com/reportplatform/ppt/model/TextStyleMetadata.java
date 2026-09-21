package com.reportplatform.ppt.model;

public record TextStyleMetadata(
        String fontFamily,
        Double fontSizePoints,
        String fontColor,
        boolean bold,
        boolean italic,
        boolean underlined,
        String textAlign,
        Double lineSpacing) {
}

