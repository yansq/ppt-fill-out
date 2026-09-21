package com.reportplatform.ppt.model;

import java.util.List;

public record ParseResponse(
        String fileId,
        String parserVersion,
        long widthEmu,
        long heightEmu,
        List<SlideMetadata> slides,
        List<String> warnings) {
}

