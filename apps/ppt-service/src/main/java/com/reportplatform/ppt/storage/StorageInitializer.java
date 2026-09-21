package com.reportplatform.ppt.storage;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class StorageInitializer {

    private static final List<String> DIRECTORIES = List.of("templates", "previews", "generated", "temp");

    private final StorageProperties properties;

    public StorageInitializer(StorageProperties properties) {
        this.properties = properties;
    }

    @PostConstruct
    void createStorageLayout() throws IOException {
        Path root = properties.root().toAbsolutePath().normalize();
        Files.createDirectories(root);
        for (String directory : DIRECTORIES) {
            Files.createDirectories(root.resolve(directory));
        }
    }
}

