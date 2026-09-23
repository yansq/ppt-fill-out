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
  const isDraft = task.status === "DRAFT";
  const isFilling = task.status === "FILLING";
  const canAssign = task.status === "DRAFT" || task.status === "FILLING";
  const canViewGeneration = task.status === "COMPLETED" || task.status === "EXPORTED";
  const fillers = canAssign ? await listAssignableFillers(task.slides.flatMap((slide) => slide.assignments.map((assignment) => assignment.assignee.id))) : [];
  const review = isDraft ? null : await getReview(taskId);
  const actor = await currentActor();

  return <WorkspaceShell collector employeeNumber={actor.employeeNumber} filler={actor.roles.has("FILLER")} section="tasks" username={actor.username}><main className="page-container fill-page-container">
    <header className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b pb-4">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-primary">报告任务 · {task.reportPeriod}</p>
        <h1 className="truncate text-2xl font-semibold">{task.name}</h1>
        <p className="muted text-sm">{task.template.name} · 第 {task.template.version} 版模板 · {taskStatusText[task.status]}</p>
      </div>
      {canAssign || canViewGeneration ? <nav aria-label="任务操作" className="flex flex-wrap items-center gap-2 text-sm">
        {canAssign ? <a className="status-pill" href="#assignments">{isFilling ? "调整页面分配" : "页面分配"}</a> : null}
        {canViewGeneration ? <a className="status-pill" href={`/report-tasks/${task.id}/generation`}>生成与导出</a> : null}
      </nav> : null}
    </header>
    <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
      <p><strong className="font-semibold text-primary">当前需要：</strong>{taskNextStep(task.status)}</p>
      <p className="muted">已提交 {task.progress.submitted}/{task.progress.total} 人 · 已开始 {task.progress.started} 人 · 提交进度 {task.progress.percent}%</p>
    </div>
    {isDraft ? <section className="mb-4 rounded-lg border bg-card p-6" id="assignments">
      <h2 className="mb-4 text-xl font-semibold">按页分配填报人</h2>
      <AssignmentForm fillers={fillers} key={`${task.id}-${task.version}`} slides={task.slides} taskId={task.id} version={task.version} />
    </section> : null}
    {review ? <div id="review"><ReviewPanel initial={review} /></div> : null}
    {isFilling ? <details className="mt-8 rounded-lg border bg-card p-6" id="assignments">
      <summary className="cursor-pointer text-lg font-semibold">调整页面分配</summary>
      <div className="mt-5"><AssignmentForm fillers={fillers} key={`${task.id}-${task.version}`} slides={task.slides} taskId={task.id} version={task.version} /></div>
    </details> : null}
  </main></WorkspaceShell>;
}
