import { prisma } from "@report-platform/database";
import { NextResponse } from "next/server";

import { readiness } from "@/features/health/health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const result = await readiness({
    databaseProbe: async () => {
      await prisma.$queryRaw`SELECT 1`;
    }
  });

  return NextResponse.json(result, { status: result.status === "ok" ? 200 : 503 });
}

