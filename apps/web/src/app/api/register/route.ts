import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { RegistrationError, registerFiller } from "@/features/auth/register";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    return NextResponse.json({ user: await registerFiller(await request.json()) }, { status: 201 });
  } catch (error) {
    if (error instanceof RegistrationError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    }
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "注册信息无效，请检查工号、姓名和密码" } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: "DATABASE_UNAVAILABLE", message: "注册服务暂时不可用" } }, { status: 503 });
  }
}
