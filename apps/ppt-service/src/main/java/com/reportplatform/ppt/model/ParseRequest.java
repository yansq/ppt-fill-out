package com.reportplatform.ppt.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record ParseRequest(
        @NotBlank String fileId,
        @NotBlank String relativePath,
        @NotBlank @Pattern(regexp = "^[a-fA-F0-9]{64}$") String sha256) {
}

