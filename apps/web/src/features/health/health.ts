import type { HealthResponse } from "@report-platform/shared";

const REQUIRED_ENVIRONMENT = ["DATABASE_URL", "PPT_SERVICE_URL", "STORAGE_ROOT"] as const;

export interface ReadinessDependencies {
  databaseProbe: () => Promise<void>;
  environment?: Record<string, string | undefined>;
  now?: () => Date;
}

export function liveness(now: () => Date = () => new Date()): HealthResponse {
  return {
    service: "report-web",
    status: "ok",
    timestamp: now().toISOString()
  };
}

export async function readiness({
  databaseProbe,
  environment = process.env,
  now = () => new Date()
}: ReadinessDependencies): Promise<HealthResponse> {
  const checks: Record<string, "ok" | "error"> = {};
  let ready = true;

  for (const name of REQUIRED_ENVIRONMENT) {
    const configured = Boolean(environment[name]?.trim());
    checks[`env.${name}`] = configured ? "ok" : "error";
    ready &&= configured;
  }

  try {
    await databaseProbe();
    checks.database = "ok";
  } catch {
    checks.database = "error";
    ready = false;
  }

  return {
    service: "report-web",
    status: ready ? "ok" : "error",
    timestamp: now().toISOString(),
    checks
  };
}
