package com.reportplatform.ppt;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class PptServiceHealthTest {

    @TempDir
    static Path storageRoot;

    @Autowired
    private MockMvc mockMvc;

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("app.storage.root", storageRoot::toString);
        registry.add("app.libre-office.executable", () -> Path.of(System.getProperty("java.home"), "bin", "java").toString());
    }

    @Test
    void reportsLiveness() throws Exception {
        mockMvc.perform(get("/actuator/health/liveness"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void reportsReadinessWhenStorageAndExecutableAreAvailable() throws Exception {
        mockMvc.perform(get("/actuator/health/readiness"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
        assertThat(storageRoot.resolve("templates")).isDirectory();
        assertThat(storageRoot.resolve("previews")).isDirectory();
        assertThat(storageRoot.resolve("generated")).isDirectory();
        assertThat(storageRoot.resolve("temp")).isDirectory();
    }
}

