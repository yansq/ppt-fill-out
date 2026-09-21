import { NextResponse } from "next/server";

import { metricErrorResponse } from "@/features/metric/http-error";
import { updateMetricValue } from "@/features/metric/metric-service";

export const runtime = "nodejs";

export async function PUT(request: Request, context: { params: Promise<{ definitionId: string }> }) {
  try {
    const { definitionId } = await context.params;
    return NextResponse.json({ metric: await updateMetricValue(definitionId, await request.json()) });
  } catch (error) {
    return metricErrorResponse(error);
  }
}
