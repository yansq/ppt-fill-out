import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@report-platform/ui/button";

import { AuthorizationError, currentActor } from "@/features/auth/authorization";
import { MetricManager } from "@/features/metric/metric-manager";

export const dynamic = "force-dynamic";

export default async function MetricsPage() {
  let actor;
  try {
    actor = await currentActor();
  } catch (error) {
    if (error instanceof AuthorizationError) redirect("/api/auth/signin?callbackUrl=/metrics");
    throw error;
  }
  if (!actor.roles.has("COLLECTOR")) redirect("/my-tasks");

  return <main className="mx-auto min-h-screen max-w-5xl px-8 py-12">
    <header className="mb-8 flex items-start justify-between gap-4">
      <div>
        <p className="mb-2 text-sm font-medium text-primary">P4 · 指标管理</p>
        <h1 className="text-3xl font-semibold">测试指标</h1>
        <p className="mt-2 text-sm">按月份查询、修改指标并查看原因与历史；修改采用源库版本号防止并发覆盖。</p>
      </div>
      <Button asChild variant="outline"><Link href="/data-sources">数据源</Link></Button>
    </header>
    <MetricManager initialPeriod={new Date().toISOString().slice(0, 7)} />
  </main>;
}
