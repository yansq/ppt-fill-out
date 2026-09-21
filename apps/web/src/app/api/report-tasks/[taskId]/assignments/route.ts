import { NextResponse } from "next/server";

import { taskErrorResponse } from "@/features/report-task/http-error";
import { replaceTaskAssignments } from "@/features/report-task/report-task-service";

export const runtime = "nodejs";

export async function PUT(request: Request, context: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await context.params;
    return NextResponse.json({ task: await replaceTaskAssignments(taskId, await request.json()) });
  } catch (error) {
    return taskErrorResponse(error);
  }
}
