import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthorizationError } from "@/features/auth/authorization";

import { DataSourceError } from "./data-source-service";

export function dataSourceErrorResponse(error: unknown) {
  if (error instanceof AuthorizationError || error instanceof DataSourceError) {
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  if (error instanceof ZodError || error instanceof SyntaxError) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "请求参数无效" } }, { status: 400 });
  }
  return NextResponse.json({ error: { code: "DATABASE_UNAVAILABLE", message: "数据源服务暂时不可用" } }, { status: 503 });
}
