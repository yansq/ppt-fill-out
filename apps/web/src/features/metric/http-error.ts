import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthorizationError } from "@/features/auth/authorization";
import { ReportTaskError } from "@/features/report-task/report-task-service";

import { MetricServiceError } from "./metric-service";

export function metricErrorResponse(error: unknown) {
  if (error instanceof AuthorizationError || error instanceof ReportTaskError || error instanceof MetricServiceError) {
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  if (error instanceof ZodError || error instanceof SyntaxError) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "请求参数无效" } }, { status: 400 });
  }
  return NextResponse.json({ error: { code: "DATABASE_UNAVAILABLE", message: "指标服务暂时不可用" } }, { status: 503 });
}
