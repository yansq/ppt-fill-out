package com.reportplatform.ppt.model;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

public record GenerateRequest(
        @NotBlank String relativePath,
        @NotBlank @Pattern(regexp = "[0-9a-fA-F]{64}") String sha256,
        @NotBlank @Pattern(regexp = "[0-9a-fA-F-]{36}") String generationId,
        @NotNull @Size(max = 1000) List<@Valid GenerateValue> values) {
}
