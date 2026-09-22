import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace-shell";
import { instanceStatusText, taskNextStep, taskStatusText } from "@/components/status";

import { AuthorizationError } from "@/features/auth/authorization";
import { currentActor } from "@/features/auth/authorization";
import { GenerationPanel } from "@/features/generation/generation-panel";
import { listGeneratedFiles } from "@/features/generation/generation-service";
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
  const generated = await listGeneratedFiles(taskId);
  const actor = await currentActor();
  const canAssign = task.status === "DRAFT" || task.status === "FILLING";
  const canViewReview = task.status === "REVIEWING" || task.status === "COMPLETED" || task.status === "EXPORTED";
  const canViewGeneration = task.status === "COMPLETED" || task.status === "EXPORTED";

  return <WorkspaceShell collector filler={actor.roles.has("FILLER")} section="tasks" username={actor.username}><main className="page-container">
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="eyebrow">报告任务 · {task.reportPeriod}</p>
        <h1 className="text-3xl font-semibold">{task.name}</h1>
        <p className="mt-2 muted text-sm">{task.template.name} · 第 {task.template.version} 版模板 · {taskStatusText[task.status]}</p>
      </div>
    </header>
    <div className="step-note mb-6"><strong>当前需要：</strong>{taskNextStep(task.status)}。{task.status === "FILLING" ? "等待填报人提交后即可审核。" : task.status === "REVIEWING" ? "逐项确认最终值，完成审核后生成报告。" : null}</div>
    <nav aria-label="任务步骤" className="mb-6 flex flex-wrap gap-2 text-sm">{canAssign ? <a className="status-pill" href="#assignments">1 页面分配</a> : <span className="status-pill">1 已分配</span>}<a className="status-pill" href="#progress">2 填报进度</a>{canViewReview ? <a className="status-pill" href="#review">3 内容审核</a> : <span className="status-pill">3 等待审核</span>}{canViewGeneration ? <a className="status-pill" href="#generation">4 生成导出</a> : <span className="status-pill">4 等待生成</span>}</nav>
    <section className="grid gap-4 rounded-lg border bg-card p-6 sm:grid-cols-4">
      <div><p className="text-sm">总实例</p><p className="text-2xl font-semibold">{task.progress.total}</p></div>
      <div><p className="text-sm">已开始</p><p className="text-2xl font-semibold">{task.progress.started}</p></div>
      <div><p className="text-sm">已提交</p><p className="text-2xl font-semibold">{task.progress.submitted}</p></div>
      <div><p className="text-sm">提交进度</p><p className="text-2xl font-semibold">{task.progress.percent}%</p></div>
    </section>
    {canAssign ? <section className="mt-8 rounded-lg border bg-card p-6" id="assignments">
      <h2 className="mb-4 text-xl font-semibold">按页分配填报人</h2>
      <AssignmentForm fillers={fillers} key={`${task.id}-${task.version}`} slides={task.slides} taskId={task.id} version={task.version} />
    </section> : null}
    <section className="mt-10" id="progress">
      <h2 className="mb-4 text-xl font-semibold">逐页进度</h2>
      <div className="grid gap-5 lg:grid-cols-2">{task.slides.map((slide) =>
        <article className="rounded-lg border bg-card p-5" key={slide.id}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">第 {slide.slideIndex + 1} 页</h3>
            <span className="text-sm">{slide.placeholderCount} 个占位符 · {slide.progress.total} 人 · 已提交 {slide.progress.submitted}</span>
          </div>
          {slide.previewUrl ? <Image alt={`第 ${slide.slideIndex + 1} 页模板预览`} className="mb-4 h-auto w-full rounded border" height={270} src={slide.previewUrl} unoptimized width={480} /> : null}
          {slide.assignments.length ? <ul className="space-y-2">{slide.assignments.map((assignment) =>
            <li className="flex justify-between gap-2 text-sm" key={assignment.id}>
              <span>{assignment.assignee.name || assignment.assignee.username}</span>
              <span>{instanceStatusText[assignment.fillInstance?.status ?? "NOT_STARTED"]}</span>
            </li>
          )}</ul> : <p className="text-sm">{slide.placeholderCount ? "未分配填报人" : "本页无占位符，无需分配"}</p>}
        </article>
      )}</div>
    </section>
    {canViewReview ? <div id="review"><ReviewPanel initial={review} /></div> : null}
    {canViewGeneration ? <div id="generation"><GenerationPanel initial={generated} /></div> : null}
  </main></WorkspaceShell>;
}
