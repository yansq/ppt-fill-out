import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthorizationError, requireCollector } from "@/features/auth/authorization";
import { PptxValidationError } from "@/features/template/pptx-validation";
import {
  listTemplates,
  maxUploadBytes,
  TemplateUploadError,
  uploadTemplate
} from "@/features/template/template-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET() {
  try {
    return NextResponse.json({ templates: await listTemplates() });
  } catch (error) {
    if (error instanceof TemplateUploadError || error instanceof AuthorizationError) {
      return errorResponse(error.code, error.message, error.status);
    }
    return errorResponse("DATABASE_UNAVAILABLE", "模板列表暂时不可用", 503);
  }
}

export async function POST(request: Request) {
  try {
    await requireCollector();
    const contentLength = Number.parseInt(request.headers.get("content-length") ?? "0", 10);
    const multipartOverheadAllowance = 1024 * 1024;
    if (Number.isFinite(contentLength) && contentLength > maxUploadBytes() + multipartOverheadAllowance) {
      return errorResponse("VALIDATION_ERROR", "上传请求超过大小限制", 413);
    }
    const formData = await request.formData();
    const file = formData.get("file");
    const name = formData.get("name");
    if (!(file instanceof File) || typeof name !== "string") {
      return errorResponse("VALIDATION_ERROR", "必须提供模板名称和 PPTX 文件", 400);
    }
    const template = await uploadTemplate({ name, file });
    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    if (error instanceof TemplateUploadError || error instanceof AuthorizationError) {
      return errorResponse(error.code, error.message, error.status);
    }
    if (error instanceof PptxValidationError || error instanceof ZodError) {
      return errorResponse("VALIDATION_ERROR", error.message, 400);
    }
    return errorResponse("PPT_PARSE_FAILED", "模板上传或解析失败", 422);
  }
}
