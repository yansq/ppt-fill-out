import { NextResponse } from "next/server";

import { metricErrorResponse } from "@/features/metric/http-error";
import { reconcileMetricValue } from "@/features/metric/metric-service";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ definitionId: string }> }) {
  try {
    const { definitionId } = await context.params;
    const body = await request.json() as { period?: unknown };
    return NextResponse.json(await reconcileMetricValue(definitionId, body.period));
  } catch (error) {
    return metricErrorResponse(error);
  }
}
