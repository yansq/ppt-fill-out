package com.reportplatform.ppt.model;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record StaticPreviewRequest(
        @NotBlank String relativePath,
        @NotBlank @Pattern(regexp = "[0-9a-fA-F]{64}") String sha256,
        @Min(0) int slideIndex) {
}
