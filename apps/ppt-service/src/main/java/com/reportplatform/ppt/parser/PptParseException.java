package com.reportplatform.ppt.parser;

public class PptParseException extends RuntimeException {

    public PptParseException(String message) {
        super(message);
    }

    public PptParseException(String message, Throwable cause) {
        super(message, cause);
    }
}

