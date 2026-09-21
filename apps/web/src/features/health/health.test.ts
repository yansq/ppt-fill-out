import { describe, expect, it, vi } from "vitest";

import { liveness, readiness } from "./health";

const fixedNow = () => new Date("2026-09-20T00:00:00.000Z");
const validEnvironment = {
  DATABASE_URL: "mysql://example",
  PPT_SERVICE_URL: "http://ppt-service:8080",
  STORAGE_ROOT: "/data"
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
      database: "error"
    });
  });
});

