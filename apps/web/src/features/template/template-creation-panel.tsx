"use client";

import { useState } from "react";

import { Button } from "@report-platform/ui/button";

import { SampleTemplateForm } from "./sample-template-form";
import { TemplateUploadForm } from "./template-upload-form";

type CreationMode = "upload" | "sample" | null;

export function TemplateCreationPanel({ databaseAvailable }: { databaseAvailable: boolean }) {
  const [mode, setMode] = useState<CreationMode>(null);

  function toggle(nextMode: Exclude<CreationMode, null>) {
    setMode((current) => current === nextMode ? null : nextMode);
  }

  return <section aria-labelledby="template-creation-title" className="surface template-creation" id="upload">
    <div className="template-creation-heading">
      <div>
        <h2 id="template-creation-title">添加模板</h2>
        <p>选择已有占位符的 PPTX，或从已填数据的样例生成模板。</p>
      </div>
      {databaseAvailable ? <div aria-label="添加模板方式" className="template-creation-actions" role="group">
        <Button aria-controls="template-upload-panel" aria-pressed={mode === "upload"} onClick={() => toggle("upload")} type="button" variant={mode === null || mode === "upload" ? "default" : "outline"}>上传 PPTX 模板</Button>
        <Button aria-controls="template-sample-panel" aria-pressed={mode === "sample"} onClick={() => toggle("sample")} type="button" variant={mode === "sample" ? "default" : "outline"}>从样例生成</Button>
      </div> : null}
    </div>

    {databaseAvailable ? <>
      <div className="template-method-content" hidden={mode !== "upload"} id="template-upload-panel">
        <div className="template-editor-intro">
          <h3>上传已标记模板</h3>
          <p>在需要填写的位置使用 {"{{名称}}"} 标记。上传后可在下方列表展开检查页面预览。</p>
        </div>
        <TemplateUploadForm />
      </div>
      <div className="template-method-content" hidden={mode !== "sample"} id="template-sample-panel">
        <div className="template-editor-intro">
          <h3>从样例生成模板</h3>
          <p>上传已填数据的 PPTX，检查模型提出的占位符，确认后再保存正式模板。</p>
        </div>
        <SampleTemplateForm />
      </div>
    </> : <p className="form-error mt-4" role="status">模板服务暂时不可用，请稍后重试或联系管理员。</p>}
  </section>;
}
