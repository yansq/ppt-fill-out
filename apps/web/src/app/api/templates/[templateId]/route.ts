import { NextResponse } from "next/server";

import { AuthorizationError } from "@/features/auth/authorization";
import { archiveTemplate, getTemplateDetails, TemplateUploadError } from "@/features/template/template-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function errorResponse(error: TemplateUploadError | AuthorizationError) {
  return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
}

export async function GET(_request: Request, context: { params: Promise<{ templateId: string }> }) {
  try {
    const { templateId } = await context.params;
    return NextResponse.json({ template: await getTemplateDetails(templateId) });
  } catch (error) {
    if (error instanceof TemplateUploadError || error instanceof AuthorizationError) return errorResponse(error);
    return NextResponse.json({ error: { code: "DATABASE_UNAVAILABLE", message: "模板详情暂时不可用" } }, { status: 503 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ templateId: string }> }) {
  try {
    const { templateId } = await context.params;
    return NextResponse.json({ template: await archiveTemplate(templateId) });
  } catch (error) {
    if (error instanceof TemplateUploadError || error instanceof AuthorizationError) return errorResponse(error);
    return NextResponse.json({ error: { code: "DATABASE_UNAVAILABLE", message: "删除模板失败，请稍后重试" } }, { status: 503 });
  }
}
