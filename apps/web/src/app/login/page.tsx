import { redirect } from "next/navigation";
import Link from "next/link";

import { AuthorizationError, currentActor } from "@/features/auth/authorization";
import { LoginForm } from "@/features/auth/login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; passwordChanged?: string }> }) {
  let signedIn = false;
  try { await currentActor(); signedIn = true; }
  catch (error) { if (!(error instanceof AuthorizationError)) throw error; }
  if (signedIn) redirect("/");
  const { callbackUrl, passwordChanged } = await searchParams;
  const destination = callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/";
  return <main className="login-page">
    <div className="auth-panel">
      <div className="auth-brand"><span className="login-mark">报</span><span>报告协作平台</span></div>
      <section aria-label="登录" className="login-card">
        <p className="eyebrow">账号登录</p>
        <h1>登录工作台</h1>
        <p className="muted mt-2">使用工号和密码继续工作。</p>
        {passwordChanged === "1" ? <p className="mt-4 text-sm text-primary" role="status">密码已修改，请使用新密码重新登录。</p> : null}
        <LoginForm callbackUrl={destination} />
        <p className="auth-footer">还没有账号？<Link className="text-primary underline" href="/register">注册填报人账号</Link></p>
      </section>
    </div>
  </main>;
}
