import { NextResponse } from "next/server";

import { metricErrorResponse } from "@/features/metric/http-error";
import { listMetricCatalog } from "@/features/metric/metric-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  try {
    return NextResponse.json(await listMetricCatalog({
      period: params.get("period"),
      page: params.get("page") ?? undefined,
      search: params.get("search") ?? undefined
    }));
  } catch (error) {
    return metricErrorResponse(error);
  }
}
