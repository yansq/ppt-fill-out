import type { HealthResponse } from "@report-platform/shared";

const REQUIRED_ENVIRONMENT = [
  "DATABASE_URL", "PPT_SERVICE_URL", "STORAGE_ROOT", "AUTH_SECRET", "AUTH_URL", "PPT_SERVICE_API_KEY"
] as const;

function browserAuthUrlIsValid(value: string | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.username || url.password) return false;
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

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
    const value = environment[name];
    let configured = Boolean(value?.trim());
    if (name === "AUTH_URL") configured = browserAuthUrlIsValid(value);
    if (name === "AUTH_SECRET") configured = (value?.length ?? 0) >= 32 && !value?.startsWith("replace-");
    if (name === "PPT_SERVICE_API_KEY") configured &&= !value?.startsWith("replace-");
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
