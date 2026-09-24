"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@report-platform/ui/button";

type UploadState =
  | { status: "idle" }
  | { status: "uploading" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export function TemplateUploadForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const [selectedFileName, setSelectedFileName] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fileInput = event.currentTarget.elements.namedItem("file") as HTMLInputElement | null;
    const file = fileInput?.files?.[0];
    if (!file) {
      setState({ status: "error", message: "请选择 PPTX 文件" });
      return;
    }
    const body = new FormData(event.currentTarget);
    body.set("file", file);
    setState({ status: "uploading" });
    try {
      const response = await fetch("/api/templates", {
        method: "POST",
        body
      });
      const payload = (await response.json()) as {
        template?: { name: string; slides: unknown[] };
        error?: { message?: string };
      };

      if (!response.ok || !payload.template) {
        setState({ status: "error", message: payload.error?.message ?? "模板上传失败" });
        return;
      }

      setState({
        status: "success",
        message: `${payload.template.name} 已解析，共 ${payload.template.slides.length} 页`
      });
      formRef.current?.reset();
      setSelectedFileName("");
      router.refresh();
    } catch {
      setState({ status: "error", message: "上传请求失败，请检查服务状态后重试" });
    }
  }

  return (
    <form className="space-y-5" onSubmit={submit} ref={formRef}>
      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="template-name">
          模板名称
        </label>
        <input
          className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          id="template-name"
          maxLength={191}
          name="name"
          placeholder="例如：月度经营报告"
          required
          type="text"
        />
      </div>
      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="template-file">
          PPTX 文件
        </label>
        <div className="flex min-w-0 items-center gap-3 rounded-md border bg-background p-2 focus-within:ring-2 focus-within:ring-ring">
          <input
            accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            className="sr-only"
            disabled={state.status === "uploading"}
            id="template-file"
            name="file"
            onChange={(event) => setSelectedFileName(event.currentTarget.files?.[0]?.name ?? "")}
            type="file"
          />
          <Button asChild size="sm" variant="outline"><label className="shrink-0 cursor-pointer" htmlFor="template-file">选择文件</label></Button>
          <span aria-live="polite" className="min-w-0 flex-1 truncate text-sm muted" title={selectedFileName || undefined}>{selectedFileName || "未选择文件"}</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Button disabled={state.status === "uploading"} type="submit">
          {state.status === "uploading" ? "上传并解析中…" : "上传并解析"}
        </Button>
        {state.status === "success" ? <p className="text-sm text-primary">{state.message}</p> : null}
        {state.status === "error" ? <p className="text-sm font-medium">{state.message}</p> : null}
      </div>
    </form>
  );
}
