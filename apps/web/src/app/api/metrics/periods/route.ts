import { NextResponse } from "next/server";

import { metricErrorResponse } from "@/features/metric/http-error";
import { availableMetricPeriodsForCollector } from "@/features/metric/metric-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    return NextResponse.json(await availableMetricPeriodsForCollector(new URL(request.url).searchParams.get("year")));
  } catch (error) {
    return metricErrorResponse(error);
  }
}
