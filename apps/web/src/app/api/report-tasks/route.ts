import { NextResponse } from "next/server";

import { taskErrorResponse } from "@/features/report-task/http-error";
import { createReportTask, listCollectorReportTasks } from "@/features/report-task/report-task-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ tasks: await listCollectorReportTasks() });
  } catch (error) {
    return taskErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const task = await createReportTask(await request.json());
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return taskErrorResponse(error);
  }
}
