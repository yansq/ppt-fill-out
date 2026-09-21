import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";

import { Button } from "@report-platform/ui/button";

import { AuthorizationError, currentActor } from "@/features/auth/authorization";
import { listTemplates } from "@/features/template/template-service";
import { TemplateUploadForm } from "@/features/template/template-upload-form";
import { TemplateRetryButton } from "@/features/template/template-retry-button";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  let actor;
  try {
    actor = await currentActor();
  } catch (error) {
    if (error instanceof AuthorizationError) redirect("/api/auth/signin?callbackUrl=/templates");
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
    <main className="mx-auto min-h-screen max-w-6xl px-8 py-12">
      <header className="mb-10 flex items-start justify-between gap-6">
        <div>
          <p className="mb-2 text-sm font-medium text-primary">P2 · 模板解析</p>
          <h1 className="text-3xl font-semibold tracking-tight">PPT 模板</h1>
          <p className="mt-3 max-w-3xl leading-7">
            上传固定格式的 PPTX。系统会校验文件、识别普通文本和表格中的业务占位符，并保存页面与定位信息。
          </p>
        </div>
        <div className="flex gap-2">
          {actor.roles.has("COLLECTOR") ? <Button asChild variant="outline"><Link href="/report-tasks">报告任务</Link></Button> : null}
          <Button asChild variant="outline"><Link href="/">返回首页</Link></Button>
          <Button asChild variant="outline"><Link href="/api/auth/signout">退出登录</Link></Button>
        </div>
      </header>

      {actor.roles.has("COLLECTOR") ? <section className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <h2 className="text-lg font-semibold">上传模板</h2>
        <p className="mb-6 mt-1 text-sm">首版占位符格式为 {"{{placeholder_key}}"}，支持跨 TextRun 和 Table Cell。</p>
        {databaseAvailable ? (
          <TemplateUploadForm />
        ) : (
          <p className="rounded-md border bg-background p-4 text-sm">
            系统数据库当前不可用。请检查 DATABASE_URL 和 migration 状态后重试。
          </p>
        )}
      </section> : null}

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">已上传模板</h2>
          <span className="text-sm">{templates.length} 个版本</span>
        </div>
        {templates.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center text-sm">暂无已解析模板</div>
        ) : (
          <div className="space-y-6">
            {templates.map((template) => (
              <article className="rounded-lg border bg-card p-6 shadow-sm" key={template.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {template.name} <span className="text-sm font-normal">v{template.version}</span>
                    </h3>
                    <p className="mt-1 text-sm">
                      {template.originalFilename} · {template.status} · Parser {template.parserVersion ?? "-"}
                    </p>
                  </div>
                  <span className="text-sm">{template.slides.length} 页</span>
                </div>
                {template.status === "PARSE_FAILED" && template.createdById === actor.id ? (
                  <div className="mt-4">
                    <TemplateRetryButton templateId={template.id} />
                  </div>
                ) : null}
                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                  {template.slides.map((slide) => (
                    <section className="rounded-md border bg-background p-4" key={slide.id}>
                      <div className="mb-3 flex items-center justify-between">
                        <h4 className="font-medium">第 {slide.slideIndex + 1} 页</h4>
                        <span className="text-sm">{slide.placeholders.length} 个占位符</span>
                      </div>
                      {slide.previewUrl ? (
                        <Image
                          alt={`${template.name} 第 ${slide.slideIndex + 1} 页预览`}
                          className="mb-4 h-auto w-full rounded border"
                          height={270}
                          src={slide.previewUrl}
                          unoptimized
                          width={480}
                        />
                      ) : null}
                      {slide.placeholders.length === 0 ? (
                        <p className="text-sm">无需动态填报</p>
                      ) : (
                        <ul className="space-y-2">
                          {slide.placeholders.map((placeholder) => (
                            <li className="rounded-md border px-3 py-2 text-sm" key={placeholder.id}>
                              <code>{`{{${placeholder.key}}}`}</code>
                              <span className="ml-2">{placeholder.containerType}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
