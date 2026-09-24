"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

import { Button } from "@report-platform/ui/button";

export function RegisterForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [registered, setRegistered] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const employeeNumber = String(values.get("employeeNumber") ?? "");
    const name = String(values.get("name") ?? "");
    const password = String(values.get("password") ?? "");
    const confirmPassword = String(values.get("confirmPassword") ?? "");
    setError("");
    if (password !== confirmPassword) { setError("两次输入的密码不一致"); return; }
    setPending(true);
    let registrationSucceeded = false;
    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeNumber, name, password, confirmPassword })
      });
      const result = await response.json() as { error?: { message: string } };
      if (!response.ok) { setError(result.error?.message ?? "注册失败"); return; }
      registrationSucceeded = true;
      setRegistered(true);
      const login = await signIn("credentials", { employeeNumber, password, redirect: false, redirectTo: "/" });
      if (!login || login.error) {
        setError("账号已创建，但自动登录失败，请返回登录页使用工号和密码登录。");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError(registrationSucceeded
        ? "账号已创建，但自动登录失败，请返回登录页使用工号和密码登录。"
        : "注册服务暂时不可用，请稍后重试");
    } finally {
      setPending(false);
    }
  }

  return <form className="login-form" onSubmit={submit}>
    <label>工号<input autoComplete="username" inputMode="numeric" maxLength={6} minLength={6} name="employeeNumber" pattern="[0-9]{6}" required /></label>
    <label>姓名<input autoComplete="name" maxLength={80} name="name" required /></label>
    <label>密码<input autoComplete="new-password" maxLength={1024} minLength={6} name="password" required type="password" /></label>
    <label>确认密码<input autoComplete="new-password" maxLength={1024} minLength={6} name="confirmPassword" required type="password" /></label>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <Button className="w-full" disabled={pending || registered} type="submit">{pending ? "注册并登录中…" : registered ? "账号已创建" : "注册并进入工作台"}</Button>
    <p className="text-center text-sm">已有账号？<Link className="text-primary underline" href="/login">返回登录</Link></p>
  </form>;
}
