package com.reportplatform.ppt.model;

public record RenderedFileMetadata(
        int slideIndex,
        String relativePath,
        String mimeType,
        long sizeBytes,
        String sha256) {
}
