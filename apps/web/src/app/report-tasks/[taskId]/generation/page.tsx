import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { WorkspaceShell } from "@/components/workspace-shell";
import { taskStatusText } from "@/components/status";
import { AuthorizationError, currentActor } from "@/features/auth/authorization";
import { GenerationPanel } from "@/features/generation/generation-panel";
import { listGeneratedFiles } from "@/features/generation/generation-service";
import { getCollectorReportTask, ReportTaskError } from "@/features/report-task/report-task-service";

export const dynamic = "force-dynamic";

export default async function ReportGenerationPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  let task;
  try {
    task = await getCollectorReportTask(taskId);
  } catch (error) {
    if (error instanceof AuthorizationError && error.status === 401) redirect(`/login?callbackUrl=/report-tasks/${taskId}/generation`);
    if (error instanceof ReportTaskError || error instanceof AuthorizationError) notFound();
    throw error;
  }
  if (task.status !== "COMPLETED" && task.status !== "EXPORTED") redirect(`/report-tasks/${taskId}#review`);

  const [generated, actor] = await Promise.all([listGeneratedFiles(taskId), currentActor()]);
  return <WorkspaceShell collector employeeNumber={actor.employeeNumber} filler={actor.roles.has("FILLER")} section="tasks" username={actor.username}>
    <main className="page-container fill-page-container">
      <header className="page-heading">
        <div>
          <p className="eyebrow">报告任务 · {task.reportPeriod}</p>
          <h1>生成与导出报告</h1>
          <p className="muted">{task.name} · {task.template.name} · {taskStatusText[task.status]}</p>
        </div>
        <Link className="status-pill" href={`/report-tasks/${taskId}#review`}>返回审核页面</Link>
      </header>
      <GenerationPanel initial={generated} />
    </main>
  </WorkspaceShell>;
}
