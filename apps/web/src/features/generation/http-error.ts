import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthorizationError } from "@/features/auth/authorization";

import { GenerationError } from "./generation-service";

export function generationErrorResponse(error: unknown) {
  if (error instanceof AuthorizationError || error instanceof GenerationError) {
    return NextResponse.json({ error: {
      code: error.code, message: error.message,
      ...(error instanceof GenerationError && error.details ? { details: error.details } : {})
    } }, { status: error.status });
  }
  if (error instanceof ZodError || error instanceof SyntaxError) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "请求参数无效" } }, { status: 400 });
  }
  return NextResponse.json({ error: { code: "DATABASE_UNAVAILABLE", message: "报告生成服务暂时不可用" } }, { status: 503 });
}
