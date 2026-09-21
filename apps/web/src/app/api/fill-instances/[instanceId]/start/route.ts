import { NextResponse } from "next/server";

import { taskErrorResponse } from "@/features/report-task/http-error";
import { startFillInstance } from "@/features/report-task/report-task-service";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ instanceId: string }> }) {
  try {
    const { instanceId } = await context.params;
    return NextResponse.json({ instance: await startFillInstance(instanceId, await request.json()) });
  } catch (error) {
    return taskErrorResponse(error);
  }
}
