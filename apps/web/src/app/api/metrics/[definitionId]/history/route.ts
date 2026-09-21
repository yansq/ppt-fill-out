import { NextResponse } from "next/server";

import { metricErrorResponse } from "@/features/metric/http-error";
import { getMetricHistory } from "@/features/metric/metric-service";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ definitionId: string }> }) {
  try {
    const { definitionId } = await context.params;
    return NextResponse.json(await getMetricHistory(definitionId, new URL(request.url).searchParams.get("period")));
  } catch (error) {
    return metricErrorResponse(error);
  }
}
