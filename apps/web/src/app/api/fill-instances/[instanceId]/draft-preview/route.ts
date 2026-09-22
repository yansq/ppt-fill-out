import { NextResponse } from "next/server";

import { AuthorizationError } from "@/features/auth/authorization";
import { getDraftPreview } from "@/features/fill-in/draft-preview-service";
import { ReportTaskError } from "@/features/report-task/report-task-service";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ instanceId: string }> }) {
  try {
    const { instanceId } = await context.params;
    const rawVersion = new URL(request.url).searchParams.get("version");
    const version = rawVersion === null ? NaN : Number(rawVersion);
    if (!Number.isSafeInteger(version) || version < 0) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "草稿版本无效" } }, { status: 400 });
    }
    const preview = await getDraftPreview(instanceId, version);
    return new NextResponse(new Uint8Array(preview.bytes), {
      headers: {
        "Content-Type": "image/png",
        ETag: `"${preview.sha256}"`,
        "Cache-Control": "private, no-store"
      }
    });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof ReportTaskError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    }
    return NextResponse.json({ error: { code: "PREVIEW_UNAVAILABLE", message: "草稿预览暂时不可用" } }, { status: 503 });
  }
}
