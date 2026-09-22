import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "@report-platform/ui/button";

import { AuthorizationError } from "@/features/auth/authorization";
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
    if (error instanceof AuthorizationError && error.status === 401) redirect(`/api/auth/signin?callbackUrl=/report-tasks/${taskId}`);
    if (error instanceof ReportTaskError || error instanceof AuthorizationError) notFound();
    throw error;
  }
  const fillers = await listAssignableFillers(task.slides.flatMap((slide) => slide.assignments.map((assignment) => assignment.assignee.id)));
  const review = await getReview(taskId);

  return <main className="mx-auto min-h-screen max-w-6xl px-8 py-12">
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="mb-2 text-sm font-medium text-primary">报告任务 · {task.reportPeriod}</p>
        <h1 className="text-3xl font-semibold">{task.name}</h1>
        <p className="mt-2 text-sm">{task.template.name} v{task.template.version} · {task.status} · 版本 {task.version}</p>
      </div>
      <Button asChild variant="outline"><Link href="/report-tasks">返回任务列表</Link></Button>
    </header>
    <section className="grid gap-4 rounded-lg border bg-card p-6 sm:grid-cols-4">
      <div><p className="text-sm">总实例</p><p className="text-2xl font-semibold">{task.progress.total}</p></div>
      <div><p className="text-sm">已开始</p><p className="text-2xl font-semibold">{task.progress.started}</p></div>
      <div><p className="text-sm">已提交</p><p className="text-2xl font-semibold">{task.progress.submitted}</p></div>
      <div><p className="text-sm">提交进度</p><p className="text-2xl font-semibold">{task.progress.percent}%</p></div>
    </section>
    <section className="mt-8 rounded-lg border bg-card p-6">
      <h2 className="mb-4 text-xl font-semibold">按页分配填报人</h2>
      <AssignmentForm fillers={fillers} key={`${task.id}-${task.version}`} slides={task.slides} taskId={task.id} version={task.version} />
    </section>
    <section className="mt-10">
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
              <span>{assignment.fillInstance?.status ?? "NOT_STARTED"}</span>
            </li>
          )}</ul> : <p className="text-sm">未分配填报人</p>}
        </article>
      )}</div>
    </section>
    <ReviewPanel initial={review} />
  </main>;
}
