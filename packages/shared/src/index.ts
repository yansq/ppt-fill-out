export const REPORT_PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export type HealthStatus = "ok" | "error";

export interface HealthResponse {
  service: string;
  status: HealthStatus;
  timestamp: string;
  checks?: Record<string, HealthStatus>;
}

