"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@report-platform/ui/button";

export function StartInstanceButton({ instanceId, version }: { instanceId: string; version: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function start() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/fill-instances/${instanceId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: version })
      });
      const payload = await response.json() as { error?: { message: string } };
      if (!response.ok) {
        setMessage(payload.error?.message ?? "无法开始填报");
        return;
      }
      router.refresh();
    } catch {
      setMessage("任务服务暂时不可用");
    } finally {
      setPending(false);
    }
  }

  return <div className="flex items-center gap-3">
    <Button disabled={pending} onClick={start} type="button">{pending ? "处理中…" : "开始填报"}</Button>
    {message ? <span className="text-sm" role="alert">{message}</span> : null}
  </div>;
}
