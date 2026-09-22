import { NextResponse } from "next/server";

import { taskErrorResponse } from "@/features/report-task/http-error";
import { decideFinalValue } from "@/features/review/review-service";

export const runtime = "nodejs";

export async function PUT(request: Request, context: { params: Promise<{ taskId: string; placeholderId: string }> }) {
  try {
    const { taskId, placeholderId } = await context.params;
    return NextResponse.json(await decideFinalValue(taskId, placeholderId, await request.json()));
  } catch (error) {
    return taskErrorResponse(error);
  }
}
