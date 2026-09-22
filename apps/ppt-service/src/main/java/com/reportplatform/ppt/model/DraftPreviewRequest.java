package com.reportplatform.ppt.model;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

public record DraftPreviewRequest(
        @NotBlank String relativePath,
        @NotBlank @Pattern(regexp = "[0-9a-fA-F]{64}") String sha256,
        @Min(0) int slideIndex,
        @NotNull @Size(max = 1000) List<@Valid DraftPreviewValue> values) {
}
