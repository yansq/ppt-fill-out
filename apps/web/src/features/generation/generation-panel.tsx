"use client";

import { useState } from "react";
import Image from "next/image";

import { Button } from "@report-platform/ui/button";

import type { listGeneratedFiles } from "./generation-service";

type GenerationList = Awaited<ReturnType<typeof listGeneratedFiles>>;

export function GenerationPanel({ initial }: { initial: GenerationList }) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const latestId = data.files[0]?.generationId;
  const latest = data.files.filter((file) => file.generationId === latestId);
  const pptx = latest.find((file) => file.type === "PPTX");
  const pdf = latest.find((file) => file.type === "PDF");
  const pages = latest.filter((file) => file.type === "PNG").sort((a, b) => (a.slideIndex ?? 0) - (b.slideIndex ?? 0));
  const warnings = pptx?.warnings ?? [];
  const canGenerate = data.task.status === "COMPLETED" || data.task.status === "EXPORTED";

  async function generate() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/report-tasks/${data.task.id}/generate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: data.task.version, idempotencyKey: crypto.randomUUID() })
      });
      const result = await response.json() as GenerationList & { error?: { message: string; details?: { key: string; slideIndex: number }[] } };
      if (!response.ok) {
        const missing = result.error?.details?.map((item) => `第 ${item.slideIndex + 1} 页 {{${item.key}}}`).join("、");
        throw new Error(`${result.error?.message ?? "生成失败"}${missing ? `：${missing}` : ""}`);
      }
      setData(result);
      setMessage("报告已生成，请逐页检查真实预览后导出。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "报告生成失败");
    } finally {
      setBusy(false);
    }
  }

  async function exportFile(generatedFileId: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/report-tasks/${data.task.id}/exports`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generatedFileId })
      });
      const result = await response.json() as { downloadUrl?: string; error?: { message: string } };
      if (!response.ok || !result.downloadUrl) throw new Error(result.error?.message ?? "导出失败");
      const refreshed = await fetch(`/api/report-tasks/${data.task.id}/generate`);
      if (refreshed.ok) setData(await refreshed.json() as GenerationList);
      const link = document.createElement("a");
      link.href = `${result.downloadUrl}?download=1`;
      document.body.append(link);
      link.click();
      link.remove();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "导出失败");
    } finally {
      setBusy(false);
    }
  }

  return <section className="mt-10 rounded-lg border bg-card p-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h2 className="text-xl font-semibold">生成与导出报告</h2><p className="mt-1 text-sm">使用已确认的最终内容生成，请逐页检查后下载。</p></div>
      <Button disabled={busy || !canGenerate} onClick={generate} type="button">{busy ? "处理中…" : "生成真实预览"}</Button>
    </div>
    {!canGenerate ? <p className="mt-4 text-sm">完成审核后才能生成报告。</p> : null}
    {latest.length > 0 ? <div className="mt-6 space-y-5">
      <div className="flex flex-wrap gap-3">
        {pptx ? <Button disabled={busy} onClick={() => exportFile(pptx.id)} type="button" variant="outline">下载 PPTX</Button> : null}
        {pdf ? <Button disabled={busy} onClick={() => exportFile(pdf.id)} type="button" variant="outline">下载 PDF</Button> : null}
      </div>
      {warnings.length ? <div className="rounded-md border border-primary bg-accent p-3 text-sm" role="alert">
        <p className="font-medium">版式提示（需人工检查）</p>
        <ul className="mt-2 list-inside list-disc">{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
      </div> : null}
      <div className="grid gap-5 lg:grid-cols-2">{pages.map((page) => <article className="rounded-md border p-3" key={page.id}>
        <h3 className="mb-2 font-medium">第 {(page.slideIndex ?? 0) + 1} 页</h3>
        {page.previewUrl ? <Image alt={`第 ${(page.slideIndex ?? 0) + 1} 页真实预览`} className="h-auto w-full" height={540} src={page.previewUrl} unoptimized width={960} /> : null}
      </article>)}</div>
    </div> : null}
    {message ? <p className="mt-4 text-sm" role="status">{message}</p> : null}
  </section>;
}
