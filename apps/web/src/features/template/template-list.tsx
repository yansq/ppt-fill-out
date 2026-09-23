"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@report-platform/ui/button";
import { templateStatusText } from "../../components/status";

import { TemplateRetryButton } from "./template-retry-button";

import type { getTemplateDetails, listTemplates } from "./template-service";

type TemplateSummary = Awaited<ReturnType<typeof listTemplates>>[number];
type TemplateDetails = Awaited<ReturnType<typeof getTemplateDetails>>;

function TemplateRow({ template, actorId, canManage, onDeleted }: { template: TemplateSummary; actorId: string; canManage: boolean; onDeleted: (id: string) => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<TemplateDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function loadDetails() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/templates/${template.id}`);
      const result = await response.json() as { template?: TemplateDetails; error?: { message?: string } };
      if (!response.ok || !result.template) throw new Error(result.error?.message ?? "加载模板页面失败");
      setDetails(result.template);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "加载模板页面失败");
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    setOpen((value) => !value);
    if (!open && !details && !loading) void loadDetails();
  }

  async function remove() {
    setDeleting(true);
    setError("");
    try {
      const response = await fetch(`/api/templates/${template.id}`, { method: "DELETE" });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "删除模板失败");
      onDeleted(template.id);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除模板失败");
    } finally {
      setDeleting(false);
    }
  }

  return <article className="rounded-lg border bg-card p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <h3 className="text-lg font-semibold">{template.name} <span className="text-sm font-normal">第 {template.version} 版</span></h3>
        <p className="mt-1 break-all text-sm muted">{template.originalFilename} · {templateStatusText[template.status] ?? "待处理"} · {template.slideCount} 页</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button aria-controls={`template-pages-${template.id}`} aria-expanded={open} onClick={toggle} type="button" variant="outline">{open ? "收起页面" : "查看页面"}</Button>
        {canManage && template.createdById === actorId && template.status !== "PARSING" && template.status !== "UPLOADING" ? <Button disabled={deleting} onClick={() => setConfirmDelete(true)} type="button" variant="outline">删除模板</Button> : null}
      </div>
    </div>
    {confirmDelete ? <div className="mt-4 rounded-md border bg-background p-4 text-sm" role="group" aria-label={`删除 ${template.name} 第 ${template.version} 版`}>
      <p>确定删除“{template.name}”第 {template.version} 版？删除后将从模板列表和新任务选择中移除，原文件会保留。{template.taskCount > 0 ? `已有 ${template.taskCount} 个任务使用此模板，现有任务仍可正常查看和导出。` : ""}</p>
      <div className="mt-3 flex gap-2">
        <Button disabled={deleting} onClick={remove} size="sm" type="button">{deleting ? "删除中…" : "确认删除"}</Button>
        <Button disabled={deleting} onClick={() => setConfirmDelete(false)} size="sm" type="button" variant="outline">取消</Button>
      </div>
    </div> : null}
    {error ? <p className="mt-3 text-sm" role="alert">{error}</p> : null}
    {open ? <div className="mt-5" id={`template-pages-${template.id}`}>
      {loading ? <p className="text-sm muted">正在加载页面…</p> : details ? <>
        {details.status === "PARSE_FAILED" && canManage && template.createdById === actorId ? <div className="mb-4"><TemplateRetryButton templateId={template.id} /></div> : null}
        {details.slides.length === 0 ? <p className="text-sm muted">暂无页面预览。</p> : <div className="grid gap-4 lg:grid-cols-2">{details.slides.map((slide) => <section className="rounded-md border bg-background p-4" key={slide.id}>
          <div className="mb-3 flex items-center justify-between gap-3"><h4 className="font-medium">第 {slide.slideIndex + 1} 页</h4><span className="text-sm">{slide.placeholders.length} 个占位符</span></div>
          {slide.previewUrl ? <Image alt={`${template.name} 第 ${slide.slideIndex + 1} 页预览`} className="mb-4 h-auto w-full rounded border" height={270} src={slide.previewUrl} unoptimized width={480} /> : null}
          {slide.placeholders.length === 0 ? <p className="text-sm">无需动态填报</p> : <ul className="space-y-2">{slide.placeholders.map((placeholder) => <li className="rounded-md border px-3 py-2 text-sm" key={placeholder.id}><code>{`{{${placeholder.key}}}`}</code><span className="ml-2 muted">需要填写</span></li>)}</ul>}
        </section>)}</div>}
      </> : <Button onClick={() => void loadDetails()} type="button" variant="outline">重新加载页面</Button>}
    </div> : null}
  </article>;
}

export function TemplateList({ templates, actorId, canManage }: { templates: TemplateSummary[]; actorId: string; canManage: boolean }) {
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const visible = templates.filter((template) => !hiddenIds.includes(template.id));
  return <section className="mt-10">
    <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-semibold">已上传模板</h2><span className="text-sm">{visible.length} 个版本</span></div>
    {visible.length === 0 ? <div className="rounded-lg border bg-card p-8 text-center text-sm">暂无已上传模板</div> : <div className="space-y-3">{visible.map((template) => <TemplateRow actorId={actorId} canManage={canManage} key={`${template.id}-${template.status}`} onDeleted={(id) => setHiddenIds((ids) => [...ids, id])} template={template} />)}</div>}
  </section>;
}
