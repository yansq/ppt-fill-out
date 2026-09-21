import { NextResponse } from "next/server";

import { liveness } from "@/features/health/health";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(liveness(), { status: 200 });
}

