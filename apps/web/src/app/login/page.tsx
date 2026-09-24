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
    <section className="login-intro">
      <span className="login-mark">报</span>
      <p className="eyebrow">报告协作平台</p>
      <h1>从模板到成稿，<br />每一步都清楚。</h1>
      <p>收集人分配页面，填报人提交内容，审核确认后生成报告。</p>
      <ol className="login-steps"><li>准备模板与报告任务</li><li>按页填写并提交</li><li>审核、预览并导出</li></ol>
    </section>
    <section aria-label="登录" className="login-card">
      <p className="eyebrow">欢迎使用</p>
      <h2>登录工作台</h2>
      <p className="muted mt-2">使用分配给你的账号继续工作。</p>
      {passwordChanged === "1" ? <p className="mt-4 text-sm text-primary" role="status">密码已修改，请使用新密码重新登录。</p> : null}
      <LoginForm callbackUrl={destination} />
      <p className="mt-5 text-center text-sm">还没有账号？<Link className="text-primary underline" href="/register">注册填报人账号</Link></p>
    </section>
  </main>;
}
