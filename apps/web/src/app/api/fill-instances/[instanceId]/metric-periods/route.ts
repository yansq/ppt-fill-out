import { NextResponse } from "next/server";

import { metricErrorResponse } from "@/features/metric/http-error";
import { availableMetricPeriodsForInstance } from "@/features/metric/metric-service";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ instanceId: string }> }) {
  try {
    const { instanceId } = await context.params;
    return NextResponse.json(await availableMetricPeriodsForInstance(instanceId, new URL(request.url).searchParams.get("year")));
  } catch (error) {
    return metricErrorResponse(error);
  }
}
