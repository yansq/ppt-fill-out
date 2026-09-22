import { NextResponse } from "next/server";

import { AuthorizationError } from "@/features/auth/authorization";
import { getTemplateStaticPreview, TemplateUploadError } from "@/features/template/template-service";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ templateId: string; slideIndex: string }> }) {
  try {
    const { templateId, slideIndex: rawIndex } = await context.params;
    const slideIndex = Number.parseInt(rawIndex, 10);
    if (!Number.isInteger(slideIndex) || slideIndex < 0 || String(slideIndex) !== rawIndex) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "页面序号无效" } }, { status: 400 });
    }
    const preview = await getTemplateStaticPreview(templateId, slideIndex);
    return new NextResponse(new Uint8Array(preview.bytes), {
      headers: {
        "Content-Type": "image/png",
        ETag: `"${preview.sha256}"`,
        "Cache-Control": "private, max-age=3600"
      }
    });
  } catch (error) {
    if (error instanceof TemplateUploadError || error instanceof AuthorizationError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    }
    return NextResponse.json({ error: { code: "PREVIEW_UNAVAILABLE", message: "静态预览暂时不可用" } }, { status: 503 });
  }
}
