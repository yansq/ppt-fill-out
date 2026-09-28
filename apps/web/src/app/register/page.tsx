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
    <div className="auth-panel">
      <div className="auth-brand"><span className="login-mark">报</span><span>报告协作平台</span></div>
      <section aria-label="注册填报人账号" className="login-card">
        <p className="eyebrow">员工注册</p>
        <h1>创建填报人账号</h1>
        <p className="muted mt-2">使用六位工号注册。账号仅有填报权限。</p>
        <RegisterForm />
      </section>
    </div>
  </main>;
}
