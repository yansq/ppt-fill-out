import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "@report-platform/ui/button";

import { AuthorizationError } from "@/features/auth/authorization";
import { FillInEditor } from "@/features/fill-in/fill-in-editor";
import { getFillInstance, ReportTaskError } from "@/features/report-task/report-task-service";
import { StartInstanceButton } from "@/features/report-task/start-instance-button";

export const dynamic = "force-dynamic";

export default async function FillInstancePage({ params }: { params: Promise<{ instanceId: string }> }) {
  const { instanceId } = await params;
  let instance;
  try {
    instance = await getFillInstance(instanceId);
  } catch (error) {
    if (error instanceof AuthorizationError) redirect(`/api/auth/signin?callbackUrl=/fill-instances/${instanceId}`);
    if (error instanceof ReportTaskError) notFound();
    throw error;
  }
  return <main className="mx-auto min-h-screen max-w-5xl px-8 py-12">
    <header className="mb-8 flex items-start justify-between gap-4">
      <div>
        <p className="mb-2 text-sm font-medium text-primary">报告周期 {instance.task.reportPeriod}</p>
        <h1 className="text-3xl font-semibold">{instance.task.name} · 第 {instance.slideIndex + 1} 页</h1>
        <p className="mt-2 text-sm">填报人：{instance.assignee.name || instance.assignee.username} · 状态：{instance.status}</p>
      </div>
      <Button asChild variant="outline"><Link href="/my-tasks">我的页面</Link></Button>
    </header>
    {instance.returnReason ? <p className="mb-6 rounded-md border border-primary bg-accent p-4 text-sm" role="status">退回原因：{instance.returnReason}</p> : null}
    {instance.status === "IN_PROGRESS" || instance.status === "SUBMITTED" ? <FillInEditor initialInstance={instance} /> : <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-lg border bg-card p-5">
        <h2 className="mb-4 text-lg font-semibold">模板页预览</h2>
        <Image alt={`第 ${instance.slideIndex + 1} 页模板预览`} className="h-auto w-full rounded border" height={270} src={instance.previewUrl} unoptimized width={480} />
      </section>
      <section className="rounded-lg border bg-card p-5">
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
  </main>;
}
