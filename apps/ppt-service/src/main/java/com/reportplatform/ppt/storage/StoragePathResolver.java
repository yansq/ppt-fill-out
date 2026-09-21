package com.reportplatform.ppt.storage;

import java.nio.file.Path;
import org.springframework.stereotype.Component;

@Component
public class StoragePathResolver {

    private final Path root;

    public StoragePathResolver(StorageProperties properties) {
        this.root = properties.root().toAbsolutePath().normalize();
    }

    public Path resolveTemplate(String relativePath) {
        if (relativePath.startsWith("/") || relativePath.startsWith("\\")) {
            throw new IllegalArgumentException("Storage path must be relative");
        }

        Path normalizedRelativePath = Path.of(relativePath).normalize();
        if (normalizedRelativePath.getNameCount() < 2
                || !"templates".equals(normalizedRelativePath.getName(0).toString())) {
            throw new IllegalArgumentException("Template path must be inside the templates directory");
        }

        Path resolved = root.resolve(normalizedRelativePath).normalize();
        if (!resolved.startsWith(root.resolve("templates").normalize())) {
            throw new IllegalArgumentException("Template path escapes the storage root");
        }
        return resolved;
    }

    public Path resolvePreview(String templateId, String filename) {
        if (!templateId.matches("[0-9a-fA-F-]{36}") || !filename.matches("slide-[1-9][0-9]*\\.png")) {
            throw new IllegalArgumentException("Invalid preview path component");
        }
        return resolveWithin("previews/" + templateId + "/" + filename, "previews");
    }

    public Path createRenderTempDirectory(String operationId) {
        if (!operationId.matches("[0-9a-fA-F-]{36}")) {
            throw new IllegalArgumentException("Invalid render operation id");
        }
        return resolveWithin("temp/render-" + operationId, "temp");
    }

    public String relativePath(Path path) {
        Path normalized = path.toAbsolutePath().normalize();
        if (!normalized.startsWith(root)) {
            throw new IllegalArgumentException("Path is outside the storage root");
        }
        return root.relativize(normalized).toString().replace('\\', '/');
    }

    private Path resolveWithin(String relativePath, String requiredDirectory) {
        Path resolved = root.resolve(relativePath).normalize();
        Path requiredRoot = root.resolve(requiredDirectory).normalize();
        if (!resolved.startsWith(requiredRoot)) {
            throw new IllegalArgumentException("Path escapes the storage root");
        }
        return resolved;
    }
}
