import { NextResponse } from "next/server";

import { taskErrorResponse } from "@/features/report-task/http-error";
import { returnFillInstance } from "@/features/review/review-service";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ taskId: string; instanceId: string }> }) {
  try {
    const { taskId, instanceId } = await context.params;
    return NextResponse.json(await returnFillInstance(taskId, instanceId, await request.json()));
  } catch (error) {
    return taskErrorResponse(error);
  }
}
