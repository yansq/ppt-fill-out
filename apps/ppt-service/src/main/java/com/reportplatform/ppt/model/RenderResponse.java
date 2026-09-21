package com.reportplatform.ppt.model;

import java.util.List;

public record RenderResponse(
        String fileId,
        RenderFormat outputFormat,
        int pageCount,
        List<RenderedFileMetadata> files,
        List<String> warnings) {
}
