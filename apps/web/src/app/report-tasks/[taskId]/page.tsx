import { notFound, redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace-shell";
import { taskNextStep, taskStatusText } from "@/components/status";

import { AuthorizationError } from "@/features/auth/authorization";
import { currentActor } from "@/features/auth/authorization";
import { AssignmentForm } from "@/features/report-task/assignment-form";
import { getCollectorReportTask, listAssignableFillers, ReportTaskError } from "@/features/report-task/report-task-service";
import { ReviewPanel } from "@/features/review/review-panel";
import { getReview } from "@/features/review/review-service";

export const dynamic = "force-dynamic";

export default async function ReportTaskDetailPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  let task;
  try {
    task = await getCollectorReportTask(taskId);
  } catch (error) {
    if (error instanceof AuthorizationError && error.status === 401) redirect(`/login?callbackUrl=/report-tasks/${taskId}`);
    if (error instanceof ReportTaskError || error instanceof AuthorizationError) notFound();
    throw error;
  }
  const fillers = await listAssignableFillers(task.slides.flatMap((slide) => slide.assignments.map((assignment) => assignment.assignee.id)));
  const review = await getReview(taskId);
  const actor = await currentActor();
  const isDraft = task.status === "DRAFT";
  const isFilling = task.status === "FILLING";
  const canAssign = task.status === "DRAFT" || task.status === "FILLING";
  const canViewGeneration = task.status === "COMPLETED" || task.status === "EXPORTED";

  return <WorkspaceShell collector employeeNumber={actor.employeeNumber} filler={actor.roles.has("FILLER")} section="tasks" username={actor.username}><main className="page-container fill-page-container">
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="eyebrow">报告任务 · {task.reportPeriod}</p>
        <h1 className="text-3xl font-semibold">{task.name}</h1>
        <p className="mt-2 muted text-sm">{task.template.name} · 第 {task.template.version} 版模板 · {taskStatusText[task.status]}</p>
      </div>
    </header>
    <div className="step-note mb-6"><strong>当前需要：</strong>{taskNextStep(task.status)}。{task.status === "FILLING" ? "等待填报人提交后即可审核。" : task.status === "REVIEWING" ? "逐项确认最终值，完成审核后生成报告。" : null}</div>
    <nav aria-label="任务步骤" className="mb-6 flex flex-wrap gap-2 text-sm">{canAssign ? <a className="status-pill" href="#assignments">1 {isFilling ? "调整页面分配" : "页面分配"}</a> : <span className="status-pill">1 已分配</span>}<a className="status-pill" href="#review">2 {isFilling ? "逐页填报情况" : "页面状态与审核"}</a>{canViewGeneration ? <a className="status-pill" href={`/report-tasks/${task.id}/generation`}>3 生成导出</a> : <span className="status-pill">3 等待生成</span>}</nav>
    <section className="grid gap-4 rounded-lg border bg-card p-6 sm:grid-cols-4">
      <div><p className="text-sm">总实例</p><p className="text-2xl font-semibold">{task.progress.total}</p></div>
      <div><p className="text-sm">已开始</p><p className="text-2xl font-semibold">{task.progress.started}</p></div>
      <div><p className="text-sm">已提交</p><p className="text-2xl font-semibold">{task.progress.submitted}</p></div>
      <div><p className="text-sm">提交进度</p><p className="text-2xl font-semibold">{task.progress.percent}%</p></div>
    </section>
    {isDraft ? <section className="mt-8 rounded-lg border bg-card p-6" id="assignments">
      <h2 className="mb-4 text-xl font-semibold">按页分配填报人</h2>
      <AssignmentForm fillers={fillers} key={`${task.id}-${task.version}`} slides={task.slides} taskId={task.id} version={task.version} />
    </section> : null}
    <div id="review"><ReviewPanel initial={review} /></div>
    {isFilling ? <details className="mt-8 rounded-lg border bg-card p-6" id="assignments">
      <summary className="cursor-pointer text-lg font-semibold">调整页面分配</summary>
      <div className="mt-5"><AssignmentForm fillers={fillers} key={`${task.id}-${task.version}`} slides={task.slides} taskId={task.id} version={task.version} /></div>
    </details> : null}
  </main></WorkspaceShell>;
}
