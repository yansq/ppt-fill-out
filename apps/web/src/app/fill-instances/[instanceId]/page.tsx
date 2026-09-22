import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace-shell";
import { instanceStatusText } from "@/components/status";

import { AuthorizationError, currentActor } from "@/features/auth/authorization";
import { FillInEditor } from "@/features/fill-in/fill-in-editor";
import { FillPageNavigation } from "@/features/fill-in/page-navigation";
import { getFillInstance, listMyTaskPages, ReportTaskError } from "@/features/report-task/report-task-service";
import { StartInstanceButton } from "@/features/report-task/start-instance-button";

export const dynamic = "force-dynamic";

export default async function FillInstancePage({ params }: { params: Promise<{ instanceId: string }> }) {
  const { instanceId } = await params;
  let instance;
  try {
    instance = await getFillInstance(instanceId);
  } catch (error) {
    if (error instanceof AuthorizationError) redirect(`/login?callbackUrl=/fill-instances/${instanceId}`);
    if (error instanceof ReportTaskError) notFound();
    throw error;
  }
  const actor = await currentActor();
  const pages = instance.editable ? await listMyTaskPages(instance.task.id) : [];
  const navigation = pages.some((page) => page.id === instance.id) ? { currentId: instance.id, pages } : null;
  return <WorkspaceShell collector={actor.roles.has("COLLECTOR")} filler={actor.roles.has("FILLER")} section="mine" username={actor.username}><main className="page-container fill-page-container">
    <header className="mb-8 flex items-start justify-between gap-4">
      <div>
        <p className="mb-2 text-sm font-medium text-primary">报告周期 {instance.task.reportPeriod}</p>
        <h1 className="text-3xl font-semibold">{instance.task.name} · 第 {instance.slideIndex + 1} 页</h1>
        <p className="mt-2 text-sm muted">填报人：{instance.assignee.name || instance.assignee.username} · 状态：{instanceStatusText[instance.status]}</p>
      </div>
    </header>
    <p className="step-note mb-6">{instance.status === "NOT_STARTED" ? "先查看模板页，确认填写位置，然后开始填报。" : instance.status === "RETURNED" ? "请根据退回原因修改内容并重新提交。" : instance.status === "IN_PROGRESS" ? "填写每项内容，保存后核对预览，再提交本页。" : instance.status === "SUBMITTED" ? "本页已提交，请等待收集人审核。" : "本页已完成审核。"}</p>
    {instance.returnReason ? <p className="mb-6 rounded-md border border-primary bg-accent p-4 text-sm" role="status">退回原因：{instance.returnReason}</p> : null}
    {instance.status === "IN_PROGRESS" || instance.status === "SUBMITTED" ? <FillInEditor initialInstance={instance} navigation={navigation} /> : <div className={`fill-page-grid ${navigation ? "has-page-nav" : ""}`}>
      {navigation ? <FillPageNavigation navigation={navigation} /> : null}
      <section className="min-w-0 rounded-xl border bg-card p-4 xl:sticky xl:top-24">
        <h2 className="mb-3 text-lg font-semibold">模板页预览</h2>
        <Image alt={`第 ${instance.slideIndex + 1} 页模板预览`} className="h-auto w-full rounded border" height={720} src={instance.previewUrl} unoptimized width={1280} />
      </section>
      <section className="min-w-0 rounded-xl border bg-card p-5">
        <h2 className="mb-4 text-lg font-semibold">占位符</h2>
        {instance.placeholders.length ? <ul className="space-y-2">{instance.placeholders.map((placeholder) =>
          <li className="rounded-md border p-3 text-sm" key={placeholder.id}>
            <code>{`{{${placeholder.key}}}`}</code> <span>#{placeholder.occurrenceIndex + 1}</span>
            <p className="mt-1">{placeholder.originalText}</p>
          </li>
        )}</ul> : <p className="text-sm">此页没有动态占位符。</p>}
        {instance.editable && (instance.status === "NOT_STARTED" || instance.status === "RETURNED") ?
          <div className="mt-5"><StartInstanceButton instanceId={instance.id} version={instance.version} /></div> : null}
      </section>
    </div>}
  </main></WorkspaceShell>;
}
