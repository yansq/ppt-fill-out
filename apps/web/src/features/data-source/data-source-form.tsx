"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@report-platform/ui/button";

export function DataSourceForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      const response = await fetch("/api/data-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.get("name"),
          host: values.get("host"),
          port: Number(values.get("port")),
          databaseName: values.get("databaseName"),
          username: values.get("username"),
          password: values.get("password")
        })
      });
      const payload = await response.json() as { error?: { message: string } };
      if (!response.ok) {
        setMessage(payload.error?.message ?? "保存失败");
        return;
      }
      form.reset();
      setMessage("数据源已保存，请测试连接。此操作不会保存或显示明文密码。");
      router.refresh();
    } catch {
      setMessage("数据源服务暂时不可用");
    } finally {
      setPending(false);
    }
  }

  return <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
    <label className="grid gap-2 text-sm font-medium">名称<input className="h-10 rounded-md border bg-background px-3" maxLength={191} name="name" required /></label>
    <label className="grid gap-2 text-sm font-medium">主机名或 IP<input className="h-10 rounded-md border bg-background px-3" maxLength={255} name="host" required /></label>
    <label className="grid gap-2 text-sm font-medium">端口<input className="h-10 rounded-md border bg-background px-3" defaultValue="3306" max="65535" min="1" name="port" required type="number" /></label>
    <label className="grid gap-2 text-sm font-medium">数据库名<input className="h-10 rounded-md border bg-background px-3" maxLength={191} name="databaseName" required /></label>
    <label className="grid gap-2 text-sm font-medium">用户名<input autoComplete="off" className="h-10 rounded-md border bg-background px-3" maxLength={191} name="username" required /></label>
    <label className="grid gap-2 text-sm font-medium">密码<input autoComplete="new-password" className="h-10 rounded-md border bg-background px-3" name="password" required type="password" /></label>
    <div className="flex items-center gap-4 md:col-span-2">
      <Button disabled={pending} type="submit">{pending ? "保存中…" : "保存数据源"}</Button>
      {message ? <p className="text-sm" role="status">{message}</p> : null}
    </div>
  </form>;
}

export function DataSourceCardActions({ id, name, metricCount, status }: {
  id: string;
  name: string;
  metricCount: number;
  status: "ACTIVE" | "DISABLED" | "ERROR";
}) {
  const router = useRouter();
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState("");

  async function testConnection() {
    setTesting(true);
    setTestMessage("");
    try {
      const response = await fetch(`/api/data-sources/${id}/test`, { method: "POST" });
      const payload = await response.json() as { latencyMs?: number; error?: { message: string } };
      setTestMessage(response.ok ? `连接成功 · ${payload.latencyMs ?? 0} ms` : payload.error?.message ?? "连接失败");
    } catch {
      setTestMessage("数据源服务暂时不可用");
    } finally {
      setTesting(false);
    }
  }

  async function remove() {
    setDeleting(true);
    setDeleteMessage("");
    try {
      const response = await fetch(`/api/data-sources/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json() as { error?: { message: string } };
        throw new Error(payload.error?.message ?? "删除数据源失败");
      }
      setConfirming(false);
      router.refresh();
    } catch (error) {
      setDeleteMessage(error instanceof Error ? error.message : "数据源服务暂时不可用");
    } finally {
      setDeleting(false);
    }
  }

  const statusLabel = { ACTIVE: "已启用", DISABLED: "已停用", ERROR: "连接异常" }[status];
  const reasonId = `data-source-delete-reason-${id}`;

  return <div className="data-source-card-actions">
    <div className="data-source-card-toolbar">
      <span className="status-pill" data-status={status}>{statusLabel}</span>
      <Button disabled={testing} onClick={testConnection} size="sm" type="button" variant="outline">{testing ? "测试中…" : "测试连接"}</Button>
      <Button aria-describedby={metricCount > 0 ? reasonId : undefined} disabled={deleting || metricCount > 0} onClick={() => { setConfirming(true); setDeleteMessage(""); }} size="sm" type="button" variant="outline">删除数据源</Button>
    </div>
    {metricCount > 0 ? <p className="data-source-card-note" id={reasonId}>已关联 {metricCount} 个指标，无法删除。</p> : null}
    {testMessage ? <p className="data-source-card-feedback" role="status">{testMessage}</p> : null}
    {confirming ? <div aria-label={`删除 ${name}`} className="data-source-card-confirm" role="group">
      <p>确定删除“{name}”？平台保存的连接配置将被删除，外部数据库中的数据不会改变。</p>
      <div className="data-source-card-confirm-actions">
        <Button disabled={deleting} onClick={remove} size="sm" type="button">{deleting ? "删除中…" : "确认删除"}</Button>
        <Button disabled={deleting} onClick={() => { setConfirming(false); setDeleteMessage(""); }} size="sm" type="button" variant="outline">取消</Button>
      </div>
    </div> : null}
    {deleteMessage ? <p className="data-source-card-feedback" role="alert">{deleteMessage}</p> : null}
  </div>;
}
