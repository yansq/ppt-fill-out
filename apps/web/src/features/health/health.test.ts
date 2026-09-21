import { describe, expect, it, vi } from "vitest";

import { liveness, readiness } from "./health";

const fixedNow = () => new Date("2026-09-20T00:00:00.000Z");
const validEnvironment = {
  DATABASE_URL: "mysql://example",
  PPT_SERVICE_URL: "http://ppt-service:8080",
  STORAGE_ROOT: "/data",
  AUTH_SECRET: "a-long-secret-with-at-least-32-characters",
  AUTH_URL: "https://reports.corp.internal",
  PPT_SERVICE_API_KEY: "internal-key"
};

describe("health", () => {
  it("reports liveness without checking dependencies", () => {
    expect(liveness(fixedNow)).toEqual({
      service: "report-web",
      status: "ok",
      timestamp: "2026-09-20T00:00:00.000Z"
    });
  });

  it("reports readiness when configuration and database are available", async () => {
    const databaseProbe = vi.fn().mockResolvedValue(undefined);

    const result = await readiness({ databaseProbe, environment: validEnvironment, now: fixedNow });

    expect(result.status).toBe("ok");
    expect(result.checks?.database).toBe("ok");
    expect(databaseProbe).toHaveBeenCalledOnce();
  });

  it("reports an error when configuration or database is unavailable", async () => {
    const result = await readiness({
      databaseProbe: vi.fn().mockRejectedValue(new Error("offline")),
      environment: {},
      now: fixedNow
    });

    expect(result.status).toBe("error");
    expect(result.checks).toMatchObject({
      "env.DATABASE_URL": "error",
      "env.PPT_SERVICE_URL": "error",
      "env.STORAGE_ROOT": "error",
      "env.AUTH_SECRET": "error",
      "env.AUTH_URL": "error",
      "env.PPT_SERVICE_API_KEY": "error",
      database: "error"
    });
  });

  it("accepts a non-local HTTP Auth.js URL for an intranet deployment", async () => {
    const result = await readiness({
      databaseProbe: vi.fn().mockResolvedValue(undefined),
      environment: { ...validEnvironment, AUTH_URL: "http://reports.corp.internal" },
      now: fixedNow
    });
    expect(result.status).toBe("ok");
    expect(result.checks?.["env.AUTH_URL"]).toBe("ok");
  });

  it.each(["ftp://reports.corp.internal", "http://user:pass@reports.corp.internal", "not-a-url"])(
    "rejects an invalid Auth.js URL: %s",
    async (authUrl) => {
      const result = await readiness({
        databaseProbe: vi.fn().mockResolvedValue(undefined),
        environment: { ...validEnvironment, AUTH_URL: authUrl },
        now: fixedNow
      });
      expect(result.status).toBe("error");
      expect(result.checks?.["env.AUTH_URL"]).toBe("error");
    }
  );

  it("rejects example authentication secrets", async () => {
    const result = await readiness({
      databaseProbe: vi.fn().mockResolvedValue(undefined),
      environment: { ...validEnvironment, AUTH_SECRET: "replace-with-at-least-32-random-bytes" },
      now: fixedNow
    });
    expect(result.status).toBe("error");
    expect(result.checks?.["env.AUTH_SECRET"]).toBe("error");
  });
});
