import { NextResponse } from "next/server";

import { retryTemplate, TemplateUploadError } from "@/features/template/template-service";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ templateId: string }> }
) {
  try {
    const { templateId } = await context.params;
    return NextResponse.json({ template: await retryTemplate(templateId) });
  } catch (error) {
    if (error instanceof TemplateUploadError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: { code: "PPT_PARSE_FAILED", message: "模板重新解析失败" } },
      { status: 422 }
    );
  }
}
