"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@report-platform/ui/button";
import { Select } from "@report-platform/ui/select";

type TemplateOption = { id: string; name: string; version: number; _count: { slides: number } };

export function CreateTaskForm({ templates }: { templates: TemplateOption[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [templateId, setTemplateId] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!templateId) { setError("请选择模板版本"); return; }
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/report-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          templateId: data.get("templateId"),
          reportPeriod: data.get("reportPeriod")
        })
      });
      const payload = await response.json() as { task?: { id: string }; error?: { message: string } };
      if (!response.ok || !payload.task) {
        setError(payload.error?.message ?? "创建任务失败");
        return;
      }
      router.push(`/report-tasks/${payload.task.id}`);
      router.refresh();
    } catch {
      setError("任务服务暂时不可用");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="grid gap-4 md:grid-cols-4 md:items-end" onSubmit={submit}>
      <label className="grid gap-2 text-sm font-medium">
        任务名称
        <input className="h-10 rounded-md border bg-background px-3" maxLength={191} name="name" required />
      </label>
      <div className="grid gap-2 text-sm font-medium">
        <span>模板版本</span>
        <Select aria-label="模板版本" name="templateId" onValueChange={setTemplateId} options={templates.map((template) => ({ value: template.id, label: `${template.name} · 第 ${template.version} 版 · ${template._count.slides} 页` }))} placeholder="选择模板" value={templateId} />
      </div>
      <label className="grid gap-2 text-sm font-medium">
        报告周期
        <input className="h-10 rounded-md border bg-background px-3" name="reportPeriod" required type="month" />
      </label>
      <Button disabled={pending || templates.length === 0} type="submit">{pending ? "创建中…" : "创建任务"}</Button>
      {error ? <p className="text-sm text-primary md:col-span-4" role="alert">{error}</p> : null}
    </form>
  );
}
