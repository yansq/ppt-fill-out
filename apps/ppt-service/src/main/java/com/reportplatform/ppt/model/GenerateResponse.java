package com.reportplatform.ppt.model;

import java.util.List;

public record GenerateResponse(
        String generationId,
        int pageCount,
        List<GeneratedArtifact> files,
        List<String> warnings) {
}
