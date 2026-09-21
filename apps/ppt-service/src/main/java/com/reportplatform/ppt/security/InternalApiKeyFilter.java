package com.reportplatform.ppt.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class InternalApiKeyFilter extends OncePerRequestFilter {

    private static final String HEADER = "X-Internal-Api-Key";
    private final byte[] expectedKey;

    public InternalApiKeyFilter(@Value("${app.internal-api-key}") String expectedKey) {
        if (expectedKey == null || expectedKey.isBlank()) {
            throw new IllegalArgumentException("PPT_SERVICE_API_KEY must be configured");
        }
        this.expectedKey = expectedKey.getBytes(StandardCharsets.UTF_8);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/ppt/");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        String providedKey = request.getHeader(HEADER);
        boolean allowed = providedKey != null && MessageDigest.isEqual(
                expectedKey,
                providedKey.getBytes(StandardCharsets.UTF_8));
        if (!allowed) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED);
            return;
        }
        filterChain.doFilter(request, response);
    }
}

