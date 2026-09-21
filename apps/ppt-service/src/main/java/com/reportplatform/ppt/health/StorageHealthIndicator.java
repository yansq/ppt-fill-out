package com.reportplatform.ppt.health;

import com.reportplatform.ppt.storage.StorageProperties;
import java.nio.file.Files;
import java.nio.file.Path;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;

@Component("storage")
public class StorageHealthIndicator implements HealthIndicator {

    private final StorageProperties properties;

    public StorageHealthIndicator(StorageProperties properties) {
        this.properties = properties;
    }

    @Override
    public Health health() {
        Path root = properties.root().toAbsolutePath().normalize();
        boolean ready = Files.isDirectory(root) && Files.isReadable(root) && Files.isWritable(root);
        return ready
                ? Health.up().withDetail("root", root.toString()).build()
                : Health.down().withDetail("root", root.toString()).build();
    }
}

