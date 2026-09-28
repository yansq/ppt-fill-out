import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthorizationError, requireCollector } from "@/features/auth/authorization";
import { PptxValidationError } from "@/features/template/pptx-validation";
import { confirmGeneratedTemplate, generateTemplateCandidates, previewGeneratedTemplate } from "@/features/template/sample-template-service";
import { maxUploadBytes, TemplateUploadError } from "@/features/template/template-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireCollector();
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > maxUploadBytes() + 1024 * 1024) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "上传请求超过大小限制" } }, { status: 413 });
    }
    const body = await request.formData();
    const file = body.get("file");
    const action = body.get("action");
    if (!(file instanceof File)) throw new TemplateUploadError("VALIDATION_ERROR", "请选择样例 PPTX", 400);
    if (action === "generate") {
      const prompt = body.get("prompt");
      if (typeof prompt !== "string") throw new TemplateUploadError("VALIDATION_ERROR", "请填写提示词", 400);
      return NextResponse.json({ draft: await generateTemplateCandidates(file, prompt) });
    }
    if (action === "preview") {
      const sha256 = body.get("sha256");
      const raw = body.get("replacements");
      if (typeof sha256 !== "string" || typeof raw !== "string") {
        throw new TemplateUploadError("VALIDATION_ERROR", "预览参数不完整", 400);
      }
      const bytes = await previewGeneratedTemplate({ file, expectedSha256: sha256, replacements: JSON.parse(raw) });
      return new Response(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "Content-Disposition": "attachment; filename=template-draft.pptx",
          "Cache-Control": "private, no-store"
        }
      });
    }
    if (action === "confirm") {
      const name = body.get("name");
      const sha256 = body.get("sha256");
      const raw = body.get("replacements");
      if (typeof name !== "string" || typeof sha256 !== "string" || typeof raw !== "string") {
        throw new TemplateUploadError("VALIDATION_ERROR", "确认参数不完整", 400);
      }
      return NextResponse.json({ template: await confirmGeneratedTemplate({ file, name, expectedSha256: sha256, replacements: JSON.parse(raw) }) }, { status: 201 });
    }
    throw new TemplateUploadError("VALIDATION_ERROR", "操作类型无效", 400);
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof TemplateUploadError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    }
    if (error instanceof ZodError || error instanceof PptxValidationError || error instanceof SyntaxError) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "输入格式无效" } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: "TEMPLATE_GENERATION_FAILED", message: "模板生成失败，请检查 PPT 与模型服务" } }, { status: 502 });
  }
}
