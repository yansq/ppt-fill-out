package com.reportplatform.ppt.health;

import java.io.IOException;
import java.time.Duration;
import java.util.concurrent.TimeUnit;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;

@Component("libreOffice")
public class LibreOfficeHealthIndicator implements HealthIndicator {

    private static final Duration TIMEOUT = Duration.ofSeconds(5);

    private final String executable;

    public LibreOfficeHealthIndicator(@Value("${app.libre-office.executable:soffice}") String executable) {
        this.executable = executable;
    }

    @Override
    public Health health() {
        Process process = null;
        try {
            process = new ProcessBuilder(executable, "--version")
                    .redirectErrorStream(true)
                    .start();
            boolean finished = process.waitFor(TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
            if (!finished) {
                process.destroyForcibly();
                return Health.down().withDetail("reason", "version check timed out").build();
            }
            return process.exitValue() == 0
                    ? Health.up().withDetail("executable", executable).build()
                    : Health.down().withDetail("reason", "version check failed").build();
        } catch (IOException exception) {
            return Health.down().withDetail("reason", "executable is unavailable").build();
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return Health.down().withDetail("reason", "version check was interrupted").build();
        } finally {
            if (process != null && process.isAlive()) {
                process.destroyForcibly();
            }
        }
    }
}

