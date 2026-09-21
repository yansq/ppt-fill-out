import { NextResponse } from "next/server";

import { createDataSource, listDataSources } from "@/features/data-source/data-source-service";
import { dataSourceErrorResponse } from "@/features/data-source/http-error";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ dataSources: await listDataSources() });
  } catch (error) {
    return dataSourceErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    return NextResponse.json({ dataSource: await createDataSource(await request.json()) }, { status: 201 });
  } catch (error) {
    return dataSourceErrorResponse(error);
  }
}
