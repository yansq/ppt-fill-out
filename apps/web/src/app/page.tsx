import Link from "next/link";
import { redirect } from "next/navigation";

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
        <header className="page-heading">
          <div>
            <p className="eyebrow">工作台</p>
            <h1>{actor.username}，你好</h1>
            <p className="page-intro">{collector ? "从待处理任务继续，或创建一份新报告。" : "查看分配给你的报告页面和提交进度。"}</p>
          </div>
          {collector ? <Link className="page-action" href={templates.length ? "/report-tasks#new-task" : "/templates#upload"}>{templates.length ? "创建报告任务" : "上传第一份模板"}</Link> : null}
        </header>
        {collector ? <>
          <section aria-label="任务概览" className="overview-grid">
            <div className="overview-card"><p>需要我处理</p><strong>{attention.length}</strong><small>待分配、待审核或待生成</small></div>
            <div className="overview-card"><p>填报进行中</p><strong>{tasks.filter((task) => task.status === "FILLING").length}</strong><small>等待填报人完成页面</small></div>
            <div className="overview-card"><p>全部报告</p><strong>{tasks.length}</strong><small>{templates.length} 个可用模板</small></div>
          </section>
          <section>
            <div className="section-heading"><div><h2>需要处理</h2><p>按任务创建时间排列</p></div><Link href="/report-tasks">查看全部任务 →</Link></div>
            {attention.length ? <div className="task-list">{attention.slice(0, 6).map((task) => <Link className="task-row" href={`/report-tasks/${task.id}`} key={task.id}>
              <span className="task-row-main"><strong>{task.name}</strong><small>{task.reportPeriod} · {task.template.name}</small></span>
              <span className="status-pill">{taskStatusText[task.status]}</span><span className="task-next">{taskNextStep(task.status)} →</span>
            </Link>)}</div> : <div className="empty-state">当前没有待处理的报告任务。{tasks.length === 0 ? <Link href={templates.length ? "/report-tasks#new-task" : "/templates#upload"}>{templates.length ? "创建第一项任务 →" : "先上传模板 →"}</Link> : <Link href="/report-tasks">查看全部任务 →</Link>}</div>}
          </section>
        </> : null}
        {filler ? <section>
          <div className="section-heading"><div><h2>我的填报</h2><p>{myReports.filter((report) => !report.complete).length} 份报告需要处理</p></div><Link href="/my-tasks">查看全部填报 →</Link></div>
          {myReports.some((report) => !report.complete) ? <div className="task-list">{myReports.filter((report) => !report.complete).slice(0, 6).map((report) => <Link className="task-row" href={`/fill-instances/${report.nextPage.id}`} key={report.task.id}>
            <span className="task-row-main"><strong>{report.task.name}</strong><small>{report.task.reportPeriod} · 已提交 {report.submittedPages}/{report.totalPages} 页</small></span>
            <span className="status-pill">{report.returnedPages ? `${report.returnedPages} 页已退回` : "待处理"}</span><span className="task-next">继续填报 →</span>
          </Link>)}</div> : <div className="empty-state">{myReports.length ? "所有分配给你的报告都已提交。" : "目前没有分配给你的报告。"}{myReports.length ? <Link href="/my-tasks">查看已完成填报 →</Link> : null}</div>}
        </section> : null}
      </main>
    </WorkspaceShell>
  );
}
