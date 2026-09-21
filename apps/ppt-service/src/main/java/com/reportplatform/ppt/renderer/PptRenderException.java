package com.reportplatform.ppt.renderer;

public class PptRenderException extends RuntimeException {

    public PptRenderException(String message) {
        super(message);
    }

    public PptRenderException(String message, Throwable cause) {
        super(message, cause);
    }
}
