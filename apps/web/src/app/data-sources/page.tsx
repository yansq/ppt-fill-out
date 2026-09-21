import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@report-platform/ui/button";

import { AuthorizationError, currentActor } from "@/features/auth/authorization";
import { DataSourceForm, TestDataSourceButton } from "@/features/data-source/data-source-form";
import { listDataSources } from "@/features/data-source/data-source-service";

export const dynamic = "force-dynamic";

export default async function DataSourcesPage() {
  let actor;
  try {
    actor = await currentActor();
  } catch (error) {
    if (error instanceof AuthorizationError) redirect("/api/auth/signin?callbackUrl=/data-sources");
    throw error;
  }
  if (!actor.roles.has("COLLECTOR")) redirect("/my-tasks");
  const sources = await listDataSources();

  return <main className="mx-auto min-h-screen max-w-5xl px-8 py-12">
    <header className="mb-8 flex items-start justify-between gap-4">
      <div>
        <p className="mb-2 text-sm font-medium text-primary">P4 · 指标数据源</p>
        <h1 className="text-3xl font-semibold">MySQL 指标源</h1>
        <p className="mt-2 text-sm">配置企业内网中的独立指标库。密码加密保存，连接测试不会返回数据库错误详情。</p>
      </div>
      <div className="flex gap-2"><Button asChild variant="outline"><Link href="/metrics">指标管理</Link></Button><Button asChild variant="outline"><Link href="/report-tasks">返回任务</Link></Button></div>
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
          <p className="my-2 text-sm">{source.host}:{source.port}/{source.databaseName} · {source.username} · {source.status}</p>
          <TestDataSourceButton id={source.id} />
        </article>)}</div>}
    </section>
  </main>;
}
