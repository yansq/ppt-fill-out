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
    <header className="page-heading">
      <div>
        <p className="eyebrow">指标管理</p>
        <h1>指标管理</h1>
        <p className="page-intro">按月份查看指标，核对来源和修改记录。</p>
      </div>
    </header>
    <MetricManager initialPeriod={new Date().toISOString().slice(0, 7)} />
  </main></WorkspaceShell>;
}
