import { NextResponse } from "next/server";

import { saveBinding } from "@/features/fill-in/fill-in-service";
import { fillInErrorResponse } from "@/features/fill-in/http-error";

export const runtime = "nodejs";

export async function PUT(request: Request, context: { params: Promise<{ instanceId: string; placeholderId: string }> }) {
  try {
    const { instanceId, placeholderId } = await context.params;
    return NextResponse.json({ instance: await saveBinding(instanceId, placeholderId, await request.json()) });
  } catch (error) {
    return fillInErrorResponse(error);
  }
}
