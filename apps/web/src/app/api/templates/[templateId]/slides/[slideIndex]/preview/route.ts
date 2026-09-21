import { NextResponse } from "next/server";

import { getTemplatePreview, TemplateUploadError } from "@/features/template/template-service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ templateId: string; slideIndex: string }> }
) {
  try {
    const { templateId, slideIndex: rawSlideIndex } = await context.params;
    const slideIndex = Number.parseInt(rawSlideIndex, 10);
    if (!Number.isInteger(slideIndex) || slideIndex < 0 || String(slideIndex) !== rawSlideIndex) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "页面序号无效" } },
        { status: 400 }
      );
    }
    const preview = await getTemplatePreview(templateId, slideIndex);
    return new NextResponse(new Uint8Array(preview.bytes), {
      headers: {
        "Content-Type": preview.mimeType,
        ETag: `"${preview.sha256}"`,
        "Cache-Control": "private, max-age=3600"
      }
    });
  } catch (error) {
    if (error instanceof TemplateUploadError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: { code: "PREVIEW_UNAVAILABLE", message: "页面缩略图暂时不可用" } },
      { status: 503 }
    );
  }
}
