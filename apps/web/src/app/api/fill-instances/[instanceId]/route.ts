import { NextResponse } from "next/server";

import { taskErrorResponse } from "@/features/report-task/http-error";
import { getFillInstance } from "@/features/report-task/report-task-service";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ instanceId: string }> }) {
  try {
    const { instanceId } = await context.params;
    return NextResponse.json({ instance: await getFillInstance(instanceId) });
  } catch (error) {
    return taskErrorResponse(error);
  }
}
