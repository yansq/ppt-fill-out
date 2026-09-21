import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "@report-platform/ui/button";

import { AuthorizationError } from "@/features/auth/authorization";
import { listMyFillInstances } from "@/features/report-task/report-task-service";

export const dynamic = "force-dynamic";

export default async function MyTasksPage() {
  let instances;
  try {
    instances = await listMyFillInstances();
  } catch (error) {
    if (error instanceof AuthorizationError && error.status === 401) redirect("/api/auth/signin?callbackUrl=/my-tasks");
    if (error instanceof AuthorizationError) notFound();
    throw error;
  }
  return <main className="mx-auto min-h-screen max-w-5xl px-8 py-12">
    <header className="mb-8 flex items-start justify-between gap-4">
      <div>
        <p className="mb-2 text-sm font-medium text-primary">P3 · 填报任务</p>
        <h1 className="text-3xl font-semibold">我的填报页面</h1>
        <p className="mt-2 text-sm">这里只显示分配给当前账号的独立填报实例。</p>
      </div>
      <Button asChild variant="outline"><Link href="/">返回首页</Link></Button>
    </header>
    {instances.length ? <div className="space-y-3">{instances.map((instance) =>
      <Link className="block rounded-lg border bg-card p-5 shadow-sm hover:bg-accent" href={`/fill-instances/${instance.id}`} key={instance.id}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">{instance.task.name} · 第 {instance.slideIndex + 1} 页</h2>
          <span className="text-sm">{instance.status}</span>
        </div>
        <p className="mt-2 text-sm">报告周期 {instance.task.reportPeriod} · {instance.placeholderCount} 个占位符</p>
      </Link>
    )}</div> : <p className="rounded-lg border bg-card p-8 text-sm">暂无分配给你的页面</p>}
  </main>;
}
