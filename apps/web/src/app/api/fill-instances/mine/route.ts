import { NextResponse } from "next/server";

import { taskErrorResponse } from "@/features/report-task/http-error";
import { listMyFillInstances } from "@/features/report-task/report-task-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ instances: await listMyFillInstances() });
  } catch (error) {
    return taskErrorResponse(error);
  }
}
