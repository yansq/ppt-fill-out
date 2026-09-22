package com.reportplatform.ppt.model;

public record GeneratedArtifact(
        String type,
        Integer slideIndex,
        String relativePath,
        String mimeType,
        long sizeBytes,
        String sha256) {
}
