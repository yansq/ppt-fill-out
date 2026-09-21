import { NextResponse } from "next/server";

import { taskErrorResponse } from "@/features/report-task/http-error";
import { getCollectorReportTask } from "@/features/report-task/report-task-service";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await context.params;
    return NextResponse.json({ task: await getCollectorReportTask(taskId) });
  } catch (error) {
    return taskErrorResponse(error);
  }
}
