"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@report-platform/ui/button";

export function TemplateRetryButton({ templateId }: { templateId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "retrying" | "error">("idle");

  async function retry() {
    setState("retrying");
    try {
      const response = await fetch(`/api/templates/${templateId}/retry`, { method: "POST" });
      if (!response.ok) {
        setState("error");
        return;
      }
      setState("idle");
      router.refresh();
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button disabled={state === "retrying"} onClick={retry} size="sm" variant="outline">
        {state === "retrying" ? "重新解析中…" : "重新解析"}
      </Button>
      {state === "error" ? <span className="text-sm">重试失败，请检查服务状态</span> : null}
    </div>
  );
}
