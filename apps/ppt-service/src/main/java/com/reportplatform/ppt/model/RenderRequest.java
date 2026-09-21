package com.reportplatform.ppt.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record RenderRequest(
        @NotBlank String fileId,
        @NotBlank @Pattern(regexp = "[0-9a-fA-F-]{36}") String templateId,
        @NotBlank String relativePath,
        @NotBlank @Pattern(regexp = "[0-9a-fA-F]{64}") String sha256,
        @NotNull RenderFormat outputFormat,
        @NotBlank String idempotencyKey) {
}
