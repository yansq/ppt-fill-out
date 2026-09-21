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

export function TestDataSourceButton({ id }: { id: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function testConnection() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/data-sources/${id}/test`, { method: "POST" });
      const payload = await response.json() as { latencyMs?: number; error?: { message: string } };
      setMessage(response.ok ? `连接成功 · ${payload.latencyMs ?? 0} ms` : payload.error?.message ?? "连接失败");
    } catch {
      setMessage("数据源服务暂时不可用");
    } finally {
      setPending(false);
    }
  }

  return <div className="flex items-center gap-3">
    <Button disabled={pending} onClick={testConnection} type="button" variant="outline">{pending ? "测试中…" : "测试连接"}</Button>
    {message ? <span className="text-sm" role="status">{message}</span> : null}
  </div>;
}
