package com.reportplatform.ppt.model;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record DraftPreviewHighlight(
        @NotNull @Pattern(regexp = "[A-Za-z_][A-Za-z0-9_.-]*") String key,
        @Min(0) int occurrenceIndex) {
}
