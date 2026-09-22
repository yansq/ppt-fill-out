import { NextResponse } from "next/server";

import { generationErrorResponse } from "@/features/generation/http-error";
import { prepareExport } from "@/features/generation/generation-service";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await context.params;
    return NextResponse.json(await prepareExport(taskId, await request.json()));
  } catch (error) {
    return generationErrorResponse(error);
  }
}
