"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

import { Button } from "@report-platform/ui/button";

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const result = await signIn("credentials", {
        employeeNumber: data.get("employeeNumber"), password: data.get("password"), redirect: false, redirectTo: callbackUrl
      });
      if (result?.error) {
        setError("工号或密码错误，请重试。多次失败后账号可能暂时锁定。");
      } else {
        window.location.assign(callbackUrl);
      }
    } catch {
      setError("登录暂时不可用，请稍后再试。");
    } finally {
      setPending(false);
    }
  }

  return <form className="login-form" onSubmit={submit}>
    <label>工号<input autoComplete="username" autoFocus inputMode="numeric" maxLength={6} minLength={6} name="employeeNumber" pattern="[0-9]{6}" required /></label>
    <label>密码<input autoComplete="current-password" name="password" required type="password" /></label>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <Button className="w-full" disabled={pending} type="submit">{pending ? "正在登录…" : "登录"}</Button>
  </form>;
}
