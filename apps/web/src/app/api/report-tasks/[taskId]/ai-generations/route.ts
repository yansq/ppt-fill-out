import { NextResponse } from "next/server";

import { generateTaskCandidate } from "@/features/ai/task-ai-service";
import { taskErrorResponse } from "@/features/report-task/http-error";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await context.params;
    return NextResponse.json({ candidate: await generateTaskCandidate(taskId, await request.json()) }, { status: 201 });
  } catch (error) {
    return taskErrorResponse(error);
  }
}
