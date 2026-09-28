"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@report-platform/ui/button";

import type { SampleReplacement, SampleSegment } from "./ppt-service-client";

type Draft = { sha256: string; segments: SampleSegment[]; replacements: SampleReplacement[]; model: string };

export function SampleTemplateForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("识别样例PPT中每期、每人或每个项目会变化的具体文字、数字或日期，提出适合重用的占位符。保留标题、说明和固定文字。key 使用有意义的英文或拼音，且同一含义复用同一 key。");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [replacements, setReplacements] = useState<SampleReplacement[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function changeFile(nextFile: File | null) {
    setFile(nextFile);
    setDraft(null);
    setReplacements([]);
    setSuccess("");
  }

  async function submit(action: "generate" | "confirm") {
    if (!file) { setError("请选择样例 PPTX"); return; }
    if (action === "confirm" && (!name.trim() || replacements.length === 0)) {
      setError("请填写模板名称并至少保留一个占位符"); return;
    }
    const body = new FormData();
    body.set("action", action);
    body.set("file", file);
    if (action === "generate") body.set("prompt", prompt);
    else {
      body.set("name", name);
      body.set("sha256", draft?.sha256 ?? "");
      body.set("replacements", JSON.stringify(replacements));
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/templates/from-sample", { method: "POST", body });
      const result = await response.json() as { draft?: Draft; template?: { name: string; slides: unknown[] }; error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "请求失败");
      if (action === "generate" && result.draft) {
        setDraft(result.draft);
        setReplacements(result.draft.replacements);
      } else if (action === "confirm" && result.template) {
        setSuccess(`${result.template.name} 已生成，共 ${result.template.slides.length} 页`);
        setDraft(null);
        setReplacements([]);
        router.refresh();
      } else throw new Error("服务返回内容无效");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "请求失败");
    } finally {
      setBusy(false);
    }
  }

  async function downloadPreview() {
    if (!file || !draft || replacements.length === 0) return;
    const body = new FormData();
    body.set("action", "preview");
    body.set("file", file);
    body.set("sha256", draft.sha256);
    body.set("replacements", JSON.stringify(replacements));
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/templates/from-sample", { method: "POST", body });
      if (!response.ok) {
        const result = await response.json() as { error?: { message?: string } };
        throw new Error(result.error?.message ?? "待确认模板生成失败");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `${name.trim() || "待确认模板"}.pptx`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "待确认模板生成失败");
    } finally {
      setBusy(false);
    }
  }

  function update(index: number, patch: Partial<SampleReplacement>) {
    setReplacements((previous) => previous.map((item, current) => current === index ? { ...item, ...patch } : item));
  }

  return <div className="space-y-5">
    <div className="grid gap-2">
      <label className="text-sm font-medium" htmlFor="sample-name">模板名称</label>
      <input className="h-10 rounded-md border bg-background px-3 text-sm" id="sample-name" maxLength={191} onChange={(event) => setName(event.target.value)} placeholder="例如：月度经营报告" value={name} />
    </div>
    <div className="grid gap-2">
      <label className="text-sm font-medium" htmlFor="sample-file">已填数据的样例 PPTX</label>
      <div className="flex min-w-0 items-center gap-3 rounded-md border bg-background p-2 focus-within:ring-2 focus-within:ring-ring">
        <input
          accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          className="sr-only"
          disabled={busy}
          id="sample-file"
          onChange={(event) => changeFile(event.currentTarget.files?.[0] ?? null)}
          type="file"
        />
        <Button asChild size="sm" variant="outline"><label className="shrink-0 cursor-pointer" htmlFor="sample-file">选择文件</label></Button>
        <span aria-live="polite" className="min-w-0 flex-1 truncate text-sm muted" title={file?.name}>{file?.name || "未选择文件"}</span>
      </div>
    </div>
    <div className="grid gap-2">
      <label className="text-sm font-medium" htmlFor="sample-prompt">生成提示词</label>
      <textarea className="min-h-24 w-full rounded-md border bg-background p-3 text-sm" id="sample-prompt" maxLength={4000} onChange={(event) => setPrompt(event.target.value)} value={prompt} />
    </div>
    <Button disabled={busy || !file || !prompt.trim()} onClick={() => void submit("generate")} type="button">{busy ? "处理中…" : draft ? "重新生成候选" : "生成占位符候选"}</Button>
    {draft ? <section className="space-y-4 rounded-md border bg-background p-4" aria-label="占位符确认">
      <div><h3 className="font-semibold">确认占位符</h3><p className="text-sm muted">模型：{draft.model}。检查每条原文与 key，可修改、删除或手动添加。确认后才生成正式模板。</p></div>
      {replacements.map((item, index) => <div className="space-y-2 rounded-md border p-3" key={index}>
        <p className="text-sm muted">第 {item.segment.slideIndex + 1} 页 · 段落：{item.segment.text}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">替换的原文<input className="h-9 rounded-md border bg-background px-2" onChange={(event) => update(index, { originalText: event.target.value })} value={item.originalText} /></label>
          <label className="grid gap-1 text-sm">占位符 key<input className="h-9 rounded-md border bg-background px-2" onChange={(event) => update(index, { key: event.target.value })} value={item.key} /></label>
        </div>
        <Button disabled={busy} onClick={() => setReplacements((previous) => previous.filter((_, current) => current !== index))} size="sm" type="button" variant="outline">删除候选</Button>
      </div>)}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm" htmlFor="sample-add-segment">手动添加段落</label>
        <select className="h-9 max-w-full rounded-md border bg-background px-2 text-sm" defaultValue="" id="sample-add-segment" onChange={(event) => {
          const segment = draft.segments[Number(event.target.value)];
          if (segment) setReplacements((previous) => [...previous, { segment, originalText: "", key: "" }]);
          event.target.value = "";
        }}><option disabled value="">选择段落</option>{draft.segments.map((segment, index) => <option key={index} value={index}>第 {segment.slideIndex + 1} 页 · {segment.text.slice(0, 60)}</option>)}</select>
      </div>
      <p className="text-sm muted">请先下载待确认 PPTX 检查页面与占位符；如需修改上方原文或 key，可再次下载。确认后保存正式模板。</p>
      <div className="flex flex-wrap gap-2"><Button disabled={busy || replacements.length === 0} onClick={() => void downloadPreview()} type="button" variant="outline">下载待确认 PPTX</Button><Button disabled={busy || !name.trim() || replacements.length === 0} onClick={() => void submit("confirm")} type="button">确认并保存模板</Button></div>
    </section> : null}
    {error ? <p className="text-sm text-foreground" role="alert">{error}</p> : null}
    {success ? <p className="text-sm text-primary" role="status">{success}</p> : null}
  </div>;
}
