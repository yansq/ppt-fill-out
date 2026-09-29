import { notFound, redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace-shell";
import { taskStatusText } from "@/components/status";

import { AuthorizationError } from "@/features/auth/authorization";
import { currentActor } from "@/features/auth/authorization";
import { AssignmentForm } from "@/features/report-task/assignment-form";
import { FillingTaskWorkspace } from "@/features/report-task/filling-task-workspace";
import {
  getCollectorReportTask,
  listAssignableFillers,
  ReportTaskError,
} from "@/features/report-task/report-task-service";
import { ReviewPanel } from "@/features/review/review-panel";
import { getReview } from "@/features/review/review-service";

export const dynamic = "force-dynamic";

export default async function ReportTaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  let task;
  try {
    task = await getCollectorReportTask(taskId);
  } catch (error) {
    if (error instanceof AuthorizationError && error.status === 401)
      redirect(`/login?callbackUrl=/report-tasks/${taskId}`);
    if (error instanceof ReportTaskError || error instanceof AuthorizationError)
      notFound();
    throw error;
  }
  const isDraft = task.status === "DRAFT";
  const isFilling = task.status === "FILLING";
  const canAssign = task.status === "DRAFT" || task.status === "FILLING";
  const canViewGeneration =
    task.status === "COMPLETED" || task.status === "EXPORTED";
  const fillers = canAssign
    ? await listAssignableFillers(
        task.slides.flatMap((slide) =>
          slide.assignments.map((assignment) => assignment.assignee.id),
        ),
      )
    : [];
  const review = isDraft ? null : await getReview(taskId);
  const actor = await currentActor();
  const filledCount =
    review?.slides.reduce(
      (count, slide) =>
        count +
        slide.placeholders.filter((placeholder) => placeholder.finalValue)
          .length,
      0,
    ) ?? 0;
  const requiredCount =
    review?.slides.reduce(
      (count, slide) => count + slide.placeholders.length,
      0,
    ) ?? 0;

  return (
    <WorkspaceShell
      collector
      employeeNumber={actor.employeeNumber}
      filler={actor.roles.has("FILLER")}
      section="tasks"
      username={actor.username}
    >
      <main className={`page-container fill-page-container task-detail-page${review ? " task-detail-page-has-workspace" : ""}`}>
        <header className="task-detail-header">
          <div className="min-w-0">
            <div className="task-detail-title">
              <h1 className="truncate">{task.name}</h1>
              <span className="status-pill">{taskStatusText[task.status]}</span>
            </div>
            <p className="task-detail-meta">
              {task.reportPeriod} · {task.template.name} · 第{" "}
              {task.template.version} 版模板
            </p>
          </div>
          <div className="task-detail-tools">
            {task.progress.total > 0 ? (
              <p className="task-detail-progress">
                已提交 {task.progress.submitted}/{task.progress.total} 人
                {isFilling && requiredCount > 0
                  ? ` · 已填 ${filledCount}/${requiredCount} 项`
                  : null}
              </p>
            ) : null}
            {isDraft || canViewGeneration ? (
              <nav aria-label="任务操作" className="detail-actions">
                {isDraft ? <a href="#assignments">页面分配</a> : null}
                {canViewGeneration ? (
                  <a href={`/report-tasks/${task.id}/generation`}>生成与导出</a>
                ) : null}
              </nav>
            ) : null}
          </div>
        </header>
        {isDraft ? (
          <section
            className="mb-4 rounded-lg border bg-card p-6"
            id="assignments"
          >
            <h2 className="mb-4 text-xl font-semibold">按页分配填报人</h2>
            <AssignmentForm
              fillers={fillers}
              key={`${task.id}-${task.version}`}
              slides={task.slides}
              taskId={task.id}
              version={task.version}
            />
          </section>
        ) : null}
        {isFilling && review ? (
          <FillingTaskWorkspace
            assignment={{
              fillers,
              slides: task.slides,
              taskId: task.id,
              version: task.version,
            }}
            review={review}
          />
        ) : review ? (
          <div id="review">
            <ReviewPanel initial={review} />
          </div>
        ) : null}
      </main>
    </WorkspaceShell>
  );
}
