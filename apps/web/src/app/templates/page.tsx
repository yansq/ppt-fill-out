import { WorkspaceShell } from "@/components/workspace-shell";
import { redirect } from "next/navigation";

import { AuthorizationError, currentActor } from "@/features/auth/authorization";
import { listTemplates } from "@/features/template/template-service";
import { TemplateUploadForm } from "@/features/template/template-upload-form";
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
          <p className="eyebrow">收集人 · 模板管理</p>
          <h1 className="text-3xl font-semibold tracking-tight">PPT 模板</h1>
          <p className="mt-3 max-w-3xl leading-7">
            上传演示文稿，确认页面和填写位置。可用模板可直接用于创建报告任务。
          </p>
        </div>
      </header>

      {actor.roles.has("COLLECTOR") ? <section className="surface" id="upload">
        <h2 className="text-lg font-semibold">上传模板</h2>
        <p className="mb-6 mt-1 text-sm muted">在需要填写的位置使用 {"{{名称}}"} 标记。上传后可在模板列表中展开检查页面预览。</p>
        {databaseAvailable ? (
          <TemplateUploadForm />
        ) : (
          <p className="rounded-md border bg-background p-4 text-sm">
            模板服务暂时不可用，请稍后重试或联系管理员。
          </p>
        )}
      </section> : null}

      <TemplateList actorId={actor.id} canManage={actor.roles.has("COLLECTOR")} templates={templates} />
    </main></WorkspaceShell>
  );
}
