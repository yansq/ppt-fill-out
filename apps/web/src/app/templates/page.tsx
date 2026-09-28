import { WorkspaceShell } from "@/components/workspace-shell";
import { redirect } from "next/navigation";

import { AuthorizationError, currentActor } from "@/features/auth/authorization";
import { listTemplates } from "@/features/template/template-service";
import { TemplateCreationPanel } from "@/features/template/template-creation-panel";
import { TemplateList } from "@/features/template/template-list";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  let actor;
  try {
    actor = await currentActor();
  } catch (error) {
    if (error instanceof AuthorizationError) redirect("/login?callbackUrl=/templates");
    throw error;
  }
  let templates: Awaited<ReturnType<typeof listTemplates>> = [];
  let databaseAvailable = true;
  try {
    templates = await listTemplates();
  } catch {
    databaseAvailable = false;
  }

  return (
    <WorkspaceShell collector={actor.roles.has("COLLECTOR")} employeeNumber={actor.employeeNumber} filler={actor.roles.has("FILLER")} section="templates" username={actor.username}><main className="page-container">
      <header className="page-heading">
        <div>
          <p className="eyebrow">报告管理</p>
          <h1>PPT 模板</h1>
          <p className="page-intro">添加模板并检查已有版本的页面和占位符。</p>
        </div>
      </header>

      {actor.roles.has("COLLECTOR") ? <TemplateCreationPanel databaseAvailable={databaseAvailable} /> : null}

      <TemplateList actorId={actor.id} canManage={actor.roles.has("COLLECTOR")} templates={templates} />
    </main></WorkspaceShell>
  );
}
