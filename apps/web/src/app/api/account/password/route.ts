import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthorizationError } from "@/features/auth/authorization";
import { ChangePasswordError, changeOwnPassword } from "@/features/auth/change-password";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  try {
    await changeOwnPassword(await request.json());
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof ChangePasswordError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    }
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "密码格式无效，或两次新密码不一致" } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: "DATABASE_UNAVAILABLE", message: "密码服务暂时不可用" } }, { status: 503 });
  }
}
