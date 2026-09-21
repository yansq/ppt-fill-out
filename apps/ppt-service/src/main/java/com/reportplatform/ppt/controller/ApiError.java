package com.reportplatform.ppt.controller;

import java.time.Instant;

public record ApiError(String code, String message, Instant timestamp) {
}

