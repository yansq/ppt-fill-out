import { WorkspaceShell } from "@/components/workspace-shell";
import { redirect } from "next/navigation";

import { AuthorizationError, currentActor } from "@/features/auth/authorization";
import { DataSourceCardActions, DataSourceForm } from "@/features/data-source/data-source-form";
import { listDataSources } from "@/features/data-source/data-source-service";

export const dynamic = "force-dynamic";

export default async function DataSourcesPage() {
  let actor;
  try { actor = await currentActor(); }
  catch (error) { if (error instanceof AuthorizationError) redirect("/login?callbackUrl=/data-sources"); throw error; }
  if (!actor.roles.has("COLLECTOR")) redirect("/my-tasks");
  const sources = await listDataSources();

  return <WorkspaceShell collector employeeNumber={actor.employeeNumber} filler={actor.roles.has("FILLER")} section="sources" username={actor.username}><main className="page-container">
    <header className="page-heading"><div><p className="eyebrow">指标管理</p><h1>指标数据源</h1><p className="page-intro">管理指标库连接配置，并按需测试连通性。</p></div></header>
    <section>
      <div className="section-heading"><div><h2>已配置的数据源</h2><p>已保存的连接配置</p></div><span className="muted text-sm">共 {sources.length} 个</span></div>
      {sources.length === 0 ? <div className="empty-state">暂无数据源。<a href="#new-source">新增数据源 →</a></div> :
        <div className="data-source-list">{sources.map((source) => <article className="data-source-card" key={source.id}>
          <div className="data-source-card-details"><h3>{source.name}</h3><p>{source.host}:{source.port}/{source.databaseName} · {source.username}</p></div>
          <DataSourceCardActions id={source.id} metricCount={source._count.metricDefinitions} name={source.name} status={source.status} />
        </article>)}</div>}
    </section>
    <section className="surface mt-9" id="new-source"><div className="section-heading"><div><h2>新增数据源</h2><p>保存配置后，可以在上方列表中测试连接。</p></div></div><DataSourceForm /></section>
  </main></WorkspaceShell>;
}
