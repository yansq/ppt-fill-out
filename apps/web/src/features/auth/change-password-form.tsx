"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

import { Button } from "@report-platform/ui/button";

export function ChangePasswordForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const currentPassword = String(values.get("currentPassword") ?? "");
    const newPassword = String(values.get("newPassword") ?? "");
    const confirmPassword = String(values.get("confirmPassword") ?? "");
    setError("");
    if (newPassword !== confirmPassword) {
      setError("两次输入的新密码不一致");
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/account/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
      });
      const result = await response.json() as { error?: { message: string } };
      if (!response.ok) {
        setError(result.error?.message ?? "修改密码失败");
        return;
      }
      try {
        await signOut({ redirectTo: "/login?passwordChanged=1" });
      } catch {
        setError("密码已修改，但自动退出失败，请点击右上角的退出按钮。");
      }
    } catch {
      setError("密码服务暂时不可用，请稍后重试");
    } finally {
      setPending(false);
    }
  }

  return <form className="grid gap-4" onSubmit={submit}>
    <label className="grid gap-2 text-sm font-medium">当前密码<input autoComplete="current-password" className="h-10 rounded-md border bg-background px-3" maxLength={1024} name="currentPassword" required type="password" /></label>
    <label className="grid gap-2 text-sm font-medium">新密码<input autoComplete="new-password" className="h-10 rounded-md border bg-background px-3" maxLength={1024} minLength={6} name="newPassword" required type="password" /></label>
    <label className="grid gap-2 text-sm font-medium">确认新密码<input autoComplete="new-password" className="h-10 rounded-md border bg-background px-3" maxLength={1024} minLength={6} name="confirmPassword" required type="password" /></label>
    {error ? <p className="text-sm text-primary" role="alert">{error}</p> : null}
    <Button disabled={pending} type="submit">{pending ? "正在修改…" : "修改密码"}</Button>
  </form>;
}
