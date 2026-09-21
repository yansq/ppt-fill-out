import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@report-platform/ui/button";

import { AuthorizationError, currentActor } from "@/features/auth/authorization";
import { CreateTaskForm } from "@/features/report-task/create-task-form";
import { listCollectorReportTasks, listReadyOwnedTemplates } from "@/features/report-task/report-task-service";

export const dynamic = "force-dynamic";

export default async function ReportTasksPage() {
  let actor;
  try {
    actor = await currentActor();
  } catch (error) {
    if (error instanceof AuthorizationError) redirect("/api/auth/signin?callbackUrl=/report-tasks");
    throw error;
  }
  if (!actor.roles.has("COLLECTOR")) redirect("/my-tasks");
  const [tasks, templates] = await Promise.all([listCollectorReportTasks(), listReadyOwnedTemplates()]);

  return <main className="mx-auto min-h-screen max-w-6xl px-8 py-12">
    <header className="mb-8 flex items-start justify-between gap-4">
      <div>
        <p className="mb-2 text-sm font-medium text-primary">P3 · 任务分发</p>
        <h1 className="text-3xl font-semibold">报告任务</h1>
        <p className="mt-2 text-sm">选择已解析模板版本与报告月份，再按页分配填报人。</p>
      </div>
      <Button asChild variant="outline"><Link href="/templates">模板管理</Link></Button>
    </header>
    <section className="rounded-lg border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">创建任务</h2>
      {templates.length ? <CreateTaskForm templates={templates} /> : <p className="text-sm">暂无自己创建的 READY 模板。请先上传并解析 PPTX。</p>}
    </section>
    <section className="mt-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">我的收集任务</h2>
        <span className="text-sm">{tasks.length} 项</span>
      </div>
      {tasks.length === 0 ? <p className="rounded-lg border bg-card p-8 text-sm">暂无报告任务</p> :
        <div className="space-y-3">{tasks.map((task) =>
          <Link className="block rounded-lg border bg-card p-5 shadow-sm hover:bg-accent" href={`/report-tasks/${task.id}`} key={task.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">{task.name}</h3>
              <span className="text-sm">{task.status}</span>
            </div>
            <p className="mt-2 text-sm">{task.reportPeriod} · {task.template.name} v{task.template.version} · {task.progress.total} 个填报实例 · 已提交 {task.progress.submitted}</p>
          </Link>
        )}</div>}
    </section>
  </main>;
}
