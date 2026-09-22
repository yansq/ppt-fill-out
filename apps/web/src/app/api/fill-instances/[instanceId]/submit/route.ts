import { NextResponse } from "next/server";

import { submitFillInstance } from "@/features/fill-in/fill-in-service";
import { fillInErrorResponse } from "@/features/fill-in/http-error";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ instanceId: string }> }) {
  try {
    const { instanceId } = await context.params;
    return NextResponse.json(await submitFillInstance(instanceId, await request.json()));
  } catch (error) {
    return fillInErrorResponse(error);
  }
}
