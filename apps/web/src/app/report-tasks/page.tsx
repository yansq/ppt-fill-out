import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthorizationError, currentActor } from "@/features/auth/authorization";
import { WorkspaceShell } from "@/components/workspace-shell";
import { taskNextStep, taskStatusText } from "@/components/status";
import { CreateTaskForm } from "@/features/report-task/create-task-form";
import { listCollectorReportTasks, listReadyOwnedTemplates } from "@/features/report-task/report-task-service";

export const dynamic = "force-dynamic";

export default async function ReportTasksPage() {
  let actor;
  try { actor = await currentActor(); }
  catch (error) { if (error instanceof AuthorizationError) redirect("/login?callbackUrl=/report-tasks"); throw error; }
  if (!actor.roles.has("COLLECTOR")) redirect("/my-tasks");
  const [tasks, templates] = await Promise.all([listCollectorReportTasks(), listReadyOwnedTemplates()]);
  return <WorkspaceShell collector filler={actor.roles.has("FILLER")} section="tasks" username={actor.username}>
    <main className="page-container">
      <header className="page-heading"><div><p className="eyebrow">收集人 · 报告任务</p><h1>报告任务</h1><p className="muted">创建、分配、审核和导出都从任务中继续。</p></div></header>
      <section className="mb-9"><div className="section-heading"><div><h2>我的任务</h2><p>按创建时间排列，点击任务查看当前步骤</p></div><span className="muted text-sm">共 {tasks.length} 项</span></div>
        {tasks.length ? <div className="task-list">{tasks.map((task) => <Link className="task-row" href={`/report-tasks/${task.id}`} key={task.id}><span className="task-row-main"><strong>{task.name}</strong><small>{task.reportPeriod} · {task.template.name} · 已提交 {task.progress.submitted}/{task.progress.total}</small></span><span className="status-pill">{taskStatusText[task.status]}</span><span className="task-next">{taskNextStep(task.status)} →</span></Link>)}</div> : <div className="empty-state">尚无报告任务。请在下方创建第一项任务。</div>}
      </section>
      <section className="surface" id="new-task"><div className="section-heading"><div><h2>创建报告任务</h2><p>选择已解析的模板和报告月份，创建后即可按页分配填报人。</p></div></div>
        {templates.length ? <CreateTaskForm templates={templates} /> : <div className="empty-state">还没有可用模板。<Link href="/templates#upload">前往上传模板 →</Link></div>}
      </section>
    </main>
  </WorkspaceShell>;
}
