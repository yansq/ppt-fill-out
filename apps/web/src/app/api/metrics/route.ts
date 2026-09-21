import { NextResponse } from "next/server";

import { metricErrorResponse } from "@/features/metric/http-error";
import { queryMetricsForCollector } from "@/features/metric/metric-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    return NextResponse.json(await queryMetricsForCollector(new URL(request.url).searchParams.get("period")));
  } catch (error) {
    return metricErrorResponse(error);
  }
}
