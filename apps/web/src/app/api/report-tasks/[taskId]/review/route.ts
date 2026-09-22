import { NextResponse } from "next/server";

import { taskErrorResponse } from "@/features/report-task/http-error";
import { completeReview, getReview } from "@/features/review/review-service";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await context.params;
    return NextResponse.json(await getReview(taskId));
  } catch (error) {
    return taskErrorResponse(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await context.params;
    return NextResponse.json(await completeReview(taskId, await request.json()));
  } catch (error) {
    return taskErrorResponse(error);
  }
}
