import { WorkspaceShell } from "@/components/workspace-shell";
import { redirect } from "next/navigation";

import { AuthorizationError, currentActor } from "@/features/auth/authorization";
import { MetricManager } from "@/features/metric/metric-manager";

export const dynamic = "force-dynamic";

export default async function MetricsPage() {
  let actor;
  try {
    actor = await currentActor();
  } catch (error) {
    if (error instanceof AuthorizationError) redirect("/login?callbackUrl=/metrics");
    throw error;
  }
  if (!actor.roles.has("COLLECTOR")) redirect("/my-tasks");

  return <WorkspaceShell collector employeeNumber={actor.employeeNumber} filler={actor.roles.has("FILLER")} section="metrics" username={actor.username}><main className="page-container">
    <header className="mb-8 flex items-start justify-between gap-4">
      <div>
        <p className="eyebrow">收集人 · 指标管理</p>
        <h1 className="text-3xl font-semibold">指标管理</h1>
        <p className="mt-2 text-sm">按月份查询指标，核对当前值并查看修改记录。</p>
      </div>
    </header>
    <MetricManager initialPeriod={new Date().toISOString().slice(0, 7)} />
  </main></WorkspaceShell>;
}
