import { redirect } from "next/navigation";

import { AuthorizationError, currentActor } from "@/features/auth/authorization";
import { RegisterForm } from "@/features/auth/register-form";

export default async function RegisterPage() {
  try {
    await currentActor();
    redirect("/");
  } catch (error) {
    if (!(error instanceof AuthorizationError)) throw error;
  }

  return <main className="login-page">
    <section className="login-intro">
      <span className="login-mark">报</span>
      <p className="eyebrow">报告协作平台</p>
      <h1>注册填报账号，<br />完成分配给你的页面。</h1>
      <p>使用六位工号注册。若收集人已提前分配任务，注册后即可在“我的填报”查看。</p>
    </section>
    <section aria-label="注册填报人账号" className="login-card">
      <p className="eyebrow">员工注册</p>
      <h2>创建填报人账号</h2>
      <p className="muted mt-2">注册仅开通填报权限，不提供收集人权限。</p>
      <RegisterForm />
    </section>
  </main>;
}
