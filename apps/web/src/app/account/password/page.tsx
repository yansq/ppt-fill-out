import { redirect } from "next/navigation";

import { WorkspaceShell } from "@/components/workspace-shell";
import { AuthorizationError, currentActor } from "@/features/auth/authorization";
import { ChangePasswordForm } from "@/features/auth/change-password-form";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  let actor;
  try {
    actor = await currentActor();
  } catch (error) {
    if (error instanceof AuthorizationError) redirect("/login?callbackUrl=/account/password");
    throw error;
  }

  return <WorkspaceShell collector={actor.roles.has("COLLECTOR")} employeeNumber={actor.employeeNumber} filler={actor.roles.has("FILLER")} section="account" username={actor.username}>
    <main className="page-container">
      <div className="mx-auto max-w-lg">
        <div className="mb-8">
          <p className="eyebrow">账号设置</p>
          <h1 className="text-3xl font-semibold">修改密码</h1>
          <p className="mt-2 text-sm muted">输入当前密码，并设置至少 6 位的新密码。</p>
        </div>
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <ChangePasswordForm />
        </section>
      </div>
    </main>
  </WorkspaceShell>;
}
