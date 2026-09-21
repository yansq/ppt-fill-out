import { NextResponse } from "next/server";

import { testDataSource } from "@/features/data-source/data-source-service";
import { dataSourceErrorResponse } from "@/features/data-source/http-error";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ dataSourceId: string }> }) {
  try {
    const { dataSourceId } = await context.params;
    return NextResponse.json(await testDataSource(dataSourceId));
  } catch (error) {
    return dataSourceErrorResponse(error);
  }
}
