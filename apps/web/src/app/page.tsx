import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@report-platform/ui/button";

import {
  AuthorizationError,
  currentActor,
} from "@/features/auth/authorization";
import {
  listCollectorReportTasks,
  listMyFillInstances,
  listReadyOwnedTemplates,
} from "@/features/report-task/report-task-service";
import { summarizeMyReports } from "@/features/report-task/my-report-summary";
import { WorkspaceShell } from "@/components/workspace-shell";
import { taskNextStep, taskStatusText } from "@/components/status";

export const dynamic = "force-dynamic";

export default async function Home() {
  let actor;
  try {
    actor = await currentActor();
  } catch (error) {
    if (error instanceof AuthorizationError) redirect("/login");
    throw error;
  }
  const collector = actor.roles.has("COLLECTOR");
  const filler = actor.roles.has("FILLER");
  const [tasks, templates, instances] = await Promise.all([
    collector ? listCollectorReportTasks() : Promise.resolve([]),
    collector ? listReadyOwnedTemplates() : Promise.resolve([]),
    filler ? listMyFillInstances() : Promise.resolve([]),
  ]);
  const attention = tasks.filter(
    (task) =>
      task.status === "REVIEWING" ||
      task.status === "COMPLETED" ||
      task.status === "DRAFT",
  );
  const myReports = summarizeMyReports(instances);

  return (
    <WorkspaceShell
      collector={collector}
      employeeNumber={actor.employeeNumber}
      filler={filler}
      section="home"
      username={actor.username}
    >
      <main className="page-container space-y-8">
        <div className="page-heading">
          <div>
            <p className="eyebrow">工作台</p>
            <h1>你好，{actor.username}</h1>
            <p className="muted">
              {collector
                ? "查看报告进度，并从当前需要处理的步骤继续。"
                : "查看分配给你的页面，完成填写与提交。"}
            </p>
          </div>
        </div>
        {collector ? (
          <>
            <section className="hero-card">
              <div>
                <p className="eyebrow">报告流程</p>
                <h2>一份报告，从这里开始</h2>
                <p>
                  上传模板，创建报告任务并分配页面；填报完成后确认最终值，生成预览并导出。
                </p>
              </div>
              <Button asChild>
                <Link
                  href={
                    templates.length
                      ? "/report-tasks#new-task"
                      : "/templates#upload"
                  }
                >
                  {templates.length ? "创建报告任务" : "先上传模板"}
                </Link>
              </Button>
            </section>
            <ol className="process-grid">
              <li>
                <span>01</span>
                <strong>准备模板</strong>
                <p>上传演示文稿，确认页面与填写位置</p>
              </li>
              <li>
                <span>02</span>
                <strong>分配填报</strong>
                <p>创建任务，按页面选择填报人</p>
              </li>
              <li>
                <span>03</span>
                <strong>审核内容</strong>
                <p>处理退回与冲突，确认每项最终值</p>
              </li>
              <li>
                <span>04</span>
                <strong>生成报告</strong>
                <p>逐页检查预览，下载成稿</p>
              </li>
            </ol>
            <section>
              <div className="section-heading">
                <div>
                  <h2>现在需要处理</h2>
                  <p>优先查看待分配、待审核和待生成的任务</p>
                </div>
                <Link href="/report-tasks">查看全部任务 →</Link>
              </div>
              {attention.length ? (
                <div className="task-list">
                  {attention.slice(0, 5).map((task) => (
                    <Link
                      className="task-row"
                      href={`/report-tasks/${task.id}`}
                      key={task.id}
                    >
                      <span className="task-row-main">
                        <strong>{task.name}</strong>
                        <small>
                          {task.reportPeriod} · {task.template.name}
                        </small>
                      </span>
                      <span className="status-pill">
                        {taskStatusText[task.status]}
                      </span>
                      <span className="task-next">
                        {taskNextStep(task.status)} →
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  当前没有待处理的收集任务。
                  <Link href="/report-tasks#new-task">创建报告任务 →</Link>
                </div>
              )}
            </section>
          </>
        ) : null}
        {filler ? (
          <section>
            <div className="section-heading">
              <div>
                <h2>待填报任务</h2>
              </div>
              <Link href="/my-tasks">查看全部任务 →</Link>
            </div>
            {myReports.length ? (
              <div className="task-list">
                {myReports.slice(0, 6).map((report) => (
                  <Link
                    className="task-row"
                    href={`/fill-instances/${report.nextPage.id}`}
                    key={report.task.id}
                  >
                    <span className="task-row-main">
                      <strong>{report.task.name}</strong>
                      <small>
                        {report.task.reportPeriod} · 需填报 {report.totalPages}{" "}
                        页 · 已提交 {report.submittedPages}/{report.totalPages}{" "}
                        页
                      </small>
                    </span>
                    <span className="status-pill">
                      {report.returnedPages
                        ? "有退回页"
                        : report.complete
                          ? "已完成填报"
                          : "待处理"}
                    </span>
                    <span className="task-next">
                      {report.complete ? "查看已提交页" : "开始填报"} →
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="empty-state">目前没有分配给你的报告。</div>
            )}
          </section>
        ) : null}
      </main>
    </WorkspaceShell>
  );
}
