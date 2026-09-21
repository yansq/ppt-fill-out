import { NextResponse } from "next/server";

import { metricErrorResponse } from "@/features/metric/http-error";
import { queryMetricForInstance } from "@/features/metric/metric-service";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ instanceId: string }> }) {
  try {
    const { instanceId } = await context.params;
    const period = new URL(request.url).searchParams.get("period");
    return NextResponse.json(await queryMetricForInstance(instanceId, period));
  } catch (error) {
    return metricErrorResponse(error);
  }
}
