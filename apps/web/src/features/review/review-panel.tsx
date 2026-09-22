"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@report-platform/ui/button";
import { instanceStatusText, taskStatusText } from "@/components/status";

import type { getReview } from "./review-service";

type Review = Awaited<ReturnType<typeof getReview>>;

const statusNames = { MISSING: "缺失", CONSISTENT: "一致", CONFLICT: "冲突" } as const;

export function ReviewPanel({ initial }: { initial: Review }) {
  const router = useRouter();
  const [review, setReview] = useState(initial);
  const [manual, setManual] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function mutate(path: string, method: "PUT" | "POST", body: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, expectedVersion: review.task.version }) });
      const result = await response.json() as Review & { error?: { message: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "审核操作失败");
      setReview(result);
      setMessage("已保存审核结果");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "审核操作失败");
    } finally {
      setBusy(false);
    }
  }

  const canReview = review.task.status === "REVIEWING";
  const requiredCount = review.slides.reduce((count, slide) => count + slide.placeholders.length, 0);
  const decidedCount = review.slides.reduce((count, slide) => count + slide.placeholders.filter((placeholder) => placeholder.finalValue).length, 0);

  return <section className="mt-10 rounded-lg border bg-card p-6">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-semibold">确认最终内容</h2><p className="mt-1 text-sm">已确认 {decidedCount}/{requiredCount} 项 · {taskStatusText[review.task.status]}</p></div>
      <Button disabled={busy || !canReview || requiredCount === 0 || decidedCount !== requiredCount} onClick={() => mutate(`/api/report-tasks/${review.task.id}/review`, "POST", {})} type="button">完成审核</Button>
    </div>
    {review.slides.length === 0 ? <p className="text-sm">尚无已分配页面。</p> : <div className="space-y-7">{review.slides.map((slide) => <div className="rounded-md border p-4" key={slide.id}>
      <h3 className="mb-3 font-semibold">第 {slide.slideIndex + 1} 页</h3>
      <div className="mb-4 space-y-2">{slide.instances.map((instance) => <div className="flex flex-wrap items-center gap-2 text-sm" key={instance.id}>
        <span>{instance.assignee.name || instance.assignee.username} · {instanceStatusText[instance.status]}</span>
        {instance.status === "SUBMITTED" && canReview ? <>
          <input aria-label={`退回 ${instance.assignee.username} 的原因`} className="h-9 min-w-48 rounded-md border bg-background px-2" onChange={(event) => setReasons({ ...reasons, [instance.id]: event.target.value })} placeholder="退回原因" value={reasons[instance.id] ?? ""} />
          <Button disabled={busy || !reasons[instance.id]?.trim()} onClick={() => mutate(`/api/report-tasks/${review.task.id}/fill-instances/${instance.id}/return`, "POST", { reason: reasons[instance.id] })} size="sm" type="button" variant="outline">退回</Button>
        </> : null}
      </div>)}</div>
      <div className="space-y-4">{slide.placeholders.map((placeholder) => <div className="rounded-md border p-3 text-sm" key={placeholder.id}>
        <p className="font-medium"><code>{`{{${placeholder.key}}}`}</code> #{placeholder.occurrenceIndex + 1} · {statusNames[placeholder.status]}</p>
        <div className="mt-2 space-y-2">{placeholder.submissions.map((submission) => <div className="flex flex-wrap items-center gap-2" key={submission.id}>
          <span>{submission.assignee.name || submission.assignee.username} · 第 {submission.submissionRevision} 版：{submission.valueText}</span>
          {canReview ? <Button disabled={busy} onClick={() => mutate(`/api/report-tasks/${review.task.id}/final-values/${placeholder.id}`, "PUT", { resolutionType: "SELECTED_SUBMISSION", selectedSubmittedValueId: submission.id })} size="sm" type="button" variant="outline">采用此值</Button> : null}
        </div>)}</div>
        {canReview ? <div className="mt-3 flex flex-wrap gap-2"><input aria-label={`手工最终值 ${placeholder.key}`} className="h-9 min-w-48 flex-1 rounded-md border bg-background px-2" onChange={(event) => setManual({ ...manual, [placeholder.id]: event.target.value })} placeholder="手工最终值" value={manual[placeholder.id] ?? ""} /><Button disabled={busy || !manual[placeholder.id]?.trim()} onClick={() => mutate(`/api/report-tasks/${review.task.id}/final-values/${placeholder.id}`, "PUT", { resolutionType: "MANUAL", valueText: manual[placeholder.id] })} size="sm" type="button">保存手工值</Button></div> : null}
        {placeholder.finalValue ? <p className="mt-3 rounded-md bg-accent p-2">最终值：{placeholder.finalValue.valueText} · {placeholder.finalValue.resolutionType === "MANUAL" ? "手工确定" : "采用提交值"}</p> : null}
      </div>)}</div>
    </div>)}</div>}
    {message ? <p className="mt-4 text-sm" role="status">{message}</p> : null}
  </section>;
}
