import { NextResponse } from "next/server";

import { metricErrorResponse } from "@/features/metric/http-error";
import { createManualMetric } from "@/features/metric/metric-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    return NextResponse.json({ metric: await createManualMetric(await request.json()) }, { status: 201 });
  } catch (error) {
    return metricErrorResponse(error);
  }
}
