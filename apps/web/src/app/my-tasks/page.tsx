import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  AuthorizationError,
  currentActor,
} from "@/features/auth/authorization";
import { WorkspaceShell } from "@/components/workspace-shell";
import { summarizeMyReports } from "@/features/report-task/my-report-summary";
import { listMyFillInstances } from "@/features/report-task/report-task-service";

export const dynamic = "force-dynamic";

export default async function MyTasksPage() {
  let actor;
  let instances;
  try {
    actor = await currentActor();
    instances = await listMyFillInstances();
  } catch (error) {
    if (error instanceof AuthorizationError && error.status === 401)
      redirect("/login?callbackUrl=/my-tasks");
    if (error instanceof AuthorizationError) notFound();
    throw error;
  }
  const reports = summarizeMyReports(instances);
  const pending = reports.filter((report) => !report.complete);
  const done = reports.filter((report) => report.complete);
  return (
    <WorkspaceShell
      collector={actor.roles.has("COLLECTOR")}
      filler
      section="mine"
      username={actor.username}
    >
      <main className="page-container">
        <header className="page-heading">
          <div>
            <p className="eyebrow">填报人 · 我的报告</p>
            <h1>我的填报</h1>
          </div>
        </header>
        <section className="mb-9">
          <div className="section-heading">
            <div>
              <h2>需要处理</h2>
            </div>
            <span className="muted text-sm">{pending.length} 份报告</span>
          </div>
          {pending.length ? (
            <div className="task-list">
              {pending.map((report) => (
                <Link
                  className="task-row"
                  href={`/fill-instances/${report.nextPage.id}`}
                  key={report.task.id}
                >
                  <span className="task-row-main">
                    <strong>{report.task.name}</strong>
                    <small>
                      {report.task.reportPeriod} · 需填报 {report.totalPages} 页
                      · 已提交 {report.submittedPages}/{report.totalPages} 页
                    </small>
                  </span>
                  <span className="status-pill">
                    {report.returnedPages
                      ? `${report.returnedPages} 页已退回`
                      : "待处理"}
                  </span>
                  <span className="task-next">开始填写 →</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state">目前没有需要处理的报告。</div>
          )}
        </section>
        {done.length ? (
          <section>
            <div className="section-heading">
              <div>
                <h2>已完成填报</h2>
              </div>
              <span className="muted text-sm">{done.length} 份报告</span>
            </div>
            <div className="task-list">
              {done.map((report) => (
                <Link
                  className="task-row"
                  href={`/fill-instances/${report.nextPage.id}`}
                  key={report.task.id}
                >
                  <span className="task-row-main">
                    <strong>{report.task.name}</strong>
                    <small>
                      {report.task.reportPeriod} · 需填报 {report.totalPages} 页
                      · 已提交 {report.submittedPages}/{report.totalPages} 页
                    </small>
                  </span>
                  <span className="status-pill">已完成填报</span>
                  <span className="task-next">查看报告页面 →</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </WorkspaceShell>
  );
}
