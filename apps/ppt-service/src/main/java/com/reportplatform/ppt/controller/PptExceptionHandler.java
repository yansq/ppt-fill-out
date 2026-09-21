package com.reportplatform.ppt.controller;

import com.reportplatform.ppt.parser.PptParseException;
import com.reportplatform.ppt.renderer.PptRenderException;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class PptExceptionHandler {

    @ExceptionHandler(PptParseException.class)
    ResponseEntity<ApiError> handleParseError(PptParseException exception) {
        return ResponseEntity.unprocessableEntity()
                .body(new ApiError("PPT_PARSE_FAILED", exception.getMessage(), Instant.now()));
    }

    @ExceptionHandler(PptRenderException.class)
    ResponseEntity<ApiError> handleRenderError(PptRenderException exception) {
        return ResponseEntity.unprocessableEntity()
                .body(new ApiError("PPT_RENDER_FAILED", exception.getMessage(), Instant.now()));
    }

    @ExceptionHandler({IllegalArgumentException.class, MethodArgumentNotValidException.class})
    ResponseEntity<ApiError> handleValidationError(Exception exception) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiError("VALIDATION_ERROR", exception.getMessage(), Instant.now()));
    }
}
