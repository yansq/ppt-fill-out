import { WorkspaceShell } from "@/components/workspace-shell";
import { redirect } from "next/navigation";

import { AuthorizationError, currentActor } from "@/features/auth/authorization";
import { DataSourceForm, TestDataSourceButton } from "@/features/data-source/data-source-form";
import { listDataSources } from "@/features/data-source/data-source-service";

export const dynamic = "force-dynamic";

export default async function DataSourcesPage() {
  let actor;
  try {
    actor = await currentActor();
  } catch (error) {
    if (error instanceof AuthorizationError) redirect("/login?callbackUrl=/data-sources");
    throw error;
  }
  if (!actor.roles.has("COLLECTOR")) redirect("/my-tasks");
  const sources = await listDataSources();

  return <WorkspaceShell collector employeeNumber={actor.employeeNumber} filler={actor.roles.has("FILLER")} section="sources" username={actor.username}><main className="page-container">
    <header className="mb-8 flex items-start justify-between gap-4">
      <div>
        <p className="eyebrow">收集人 · 数据源</p>
        <h1 className="text-3xl font-semibold">指标数据源</h1>
        <p className="mt-2 text-sm">配置指标库连接，保存后测试是否可用。</p>
      </div>
    </header>
    <section className="rounded-lg border bg-card p-6 shadow-sm">
      <h2 className="mb-5 text-lg font-semibold">新增数据源</h2>
      <DataSourceForm />
    </section>
    <section className="mt-10">
      <h2 className="mb-4 text-xl font-semibold">已配置的数据源</h2>
      {sources.length === 0 ? <p className="rounded-lg border bg-card p-6 text-sm">暂无数据源。</p> :
        <div className="space-y-3">{sources.map((source) => <article className="rounded-lg border bg-card p-5" key={source.id}>
          <h3 className="font-semibold">{source.name}</h3>
          <p className="my-2 text-sm">{source.host}:{source.port}/{source.databaseName} · {source.username} · {{ ACTIVE: "可用", DISABLED: "已停用", ERROR: "连接异常" }[source.status]}</p>
          <TestDataSourceButton id={source.id} />
        </article>)}</div>}
    </section>
  </main></WorkspaceShell>;
}
