package com.reportplatform.ppt.model;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record DraftPreviewValue(
        @NotNull @Pattern(regexp = "[A-Za-z_][A-Za-z0-9_.-]*") String key,
        @Min(0) int occurrenceIndex,
        @NotNull @Size(max = 10000) String valueText) {
}
