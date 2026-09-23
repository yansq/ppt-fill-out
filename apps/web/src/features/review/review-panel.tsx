"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@report-platform/ui/button";
import { instanceStatusText, taskStatusText } from "../../components/status";
import { PptPreviewImage } from "../fill-in/ppt-preview-image";
import { AvailableMonthPicker } from "../metric/available-month-picker";

import type { getReview } from "./review-service";

type Review = Awaited<ReturnType<typeof getReview>>;
type MetricOption = { definitionId: string; code: string; name: string; valueText: string; unit: string | null; dataSource: { name: string } };

const statusNames = { MISSING: "缺失", CONSISTENT: "一致", CONFLICT: "冲突" } as const;

function metricSourceLabel(finalValue: Review["slides"][number]["placeholders"][number]["finalValue"]) {
  if (finalValue?.resolutionType !== "DATABASE_METRIC") return null;
  const snapshot = finalValue.sourceSnapshotJson;
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return "数据库指标";
  const name = typeof snapshot.metricName === "string" ? snapshot.metricName : null;
  const period = typeof snapshot.period === "string" ? snapshot.period : null;
  return ["数据库指标", name, period].filter(Boolean).join(" · ");
}

function slideStatus(slide: Review["slides"][number], isFilling = false) {
  if (slide.placeholders.length === 0) return "无需填报";
  if (slide.instances.some((instance) => instance.status === "RETURNED")) return "已退回";
  if (slide.placeholders.every((placeholder) => placeholder.finalValue)) return isFilling ? "收集人已填" : "审核完成";
  if (slide.instances.length === 0) return "待分配";
  if (slide.instances.every((instance) => instance.status === "SUBMITTED" || instance.status === "REVIEWED")) return "待审核";
  return "填报中";
}

export function ReviewPanel({ initial }: { initial: Review }) {
  const router = useRouter();
  const [updatedReview, setReview] = useState<Review | null>(null);
  const review = updatedReview && updatedReview.task.version >= initial.task.version ? updatedReview : initial;
  const [selectedSlideId, setSelectedSlideId] = useState(initial.slides[0]?.id ?? "");
  const [manual, setManual] = useState<Record<string, string>>({});
  const [metricPeriod, setMetricPeriod] = useState(initial.task.reportPeriod);
  const [metrics, setMetrics] = useState<MetricOption[]>([]);
  const [loadedPeriod, setLoadedPeriod] = useState("");
  const [metricPeriodAvailable, setMetricPeriodAvailable] = useState<boolean | null>(null);
  const [metricChoices, setMetricChoices] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function mutate(path: string, method: "PUT" | "POST", body: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, expectedVersion: review.task.version })
      });
      const result = await response.json() as Review & { error?: { message: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "审核操作失败");
      setReview(result);
      setMessage(result.task.status === "COMPLETED" ? "审核已完成，请进入生成与导出页面。" : "已保存当前页的最终值");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "审核操作失败");
    } finally {
      setBusy(false);
    }
  }

  async function loadMetrics() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/metrics?period=${encodeURIComponent(metricPeriod)}`);
      const result = await response.json() as { items?: MetricOption[]; error?: { message: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "指标加载失败");
      setMetrics(result.items ?? []);
      setLoadedPeriod(metricPeriod);
      setMetricChoices({});
      if (!result.items?.length) setMessage("该月份没有可用指标，请选择其他月份或人工输入。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "指标加载失败");
    } finally {
      setBusy(false);
    }
  }

  const canReview = review.task.status === "REVIEWING";
  const isFilling = review.task.status === "FILLING";
  const canSetValue = canReview || isFilling;
  const requiredCount = review.slides.reduce((count, slide) => count + slide.placeholders.length, 0);
  const decidedCount = review.slides.reduce((count, slide) => count + slide.placeholders.filter((placeholder) => placeholder.finalValue).length, 0);
  const assignedCount = review.slides.reduce((count, slide) => count + slide.instances.length, 0);
  const submittedCount = review.slides.reduce((count, slide) => count + slide.instances.filter((instance) => instance.status === "SUBMITTED" || instance.status === "REVIEWED").length, 0);
  const selectedSlide = review.slides.find((slide) => slide.id === selectedSlideId) ?? review.slides[0];

  return <section className="mt-10">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-semibold">{isFilling ? "逐页填报情况" : "页面状态与审核"}</h2><p className="mt-1 text-sm">{isFilling ? `已提交 ${submittedCount}/${assignedCount} 人 · 收集人已填 ${decidedCount}/${requiredCount} 项` : `已确认 ${decidedCount}/${requiredCount} 项`} · {taskStatusText[review.task.status]}</p></div>
      <div className="flex flex-wrap items-center gap-2">
        {canReview ? <Button disabled={busy || requiredCount === 0 || decidedCount !== requiredCount} onClick={() => mutate(`/api/report-tasks/${review.task.id}/review`, "POST", {})} type="button">完成审核</Button> : review.task.status === "COMPLETED" || review.task.status === "EXPORTED" ? <span className="status-pill">审核已完成</span> : null}
        {review.task.status === "COMPLETED" || review.task.status === "EXPORTED" ? <Button asChild><a href={`/report-tasks/${review.task.id}/generation`}>生成与导出</a></Button> : <Button disabled type="button" variant="outline">生成与导出</Button>}
      </div>
    </div>
    {review.slides.length === 0 || !selectedSlide ? <p className="rounded-xl border bg-card p-5 text-sm">模板暂无页面。</p> : <div aria-label={isFilling ? "填报工作区" : "审核工作区"} className="fill-page-grid has-page-nav" role="group">
      <nav aria-label={isFilling ? "填报页面导航" : "审核页面导航"} className="fill-page-nav min-w-0 rounded-xl border bg-card p-3">
        <div><p className="font-semibold">报告页面</p><p className="mt-1 text-xs muted">共 {review.slides.length} 页</p></div>
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1 xl:grid xl:overflow-visible">
          {review.slides.map((slide) => {
            const active = slide.id === selectedSlide.id;
            const complete = isFilling ? slide.instances.filter((instance) => instance.status === "SUBMITTED" || instance.status === "REVIEWED").length : slide.placeholders.filter((placeholder) => placeholder.finalValue).length;
            const total = isFilling ? slide.instances.length : slide.placeholders.length;
            return <button
              aria-label={`${isFilling ? "查看" : "审核"}第 ${slide.slideIndex + 1} 页`}
              aria-pressed={active}
              className={`block w-36 shrink-0 rounded-lg border-2 p-2 text-left xl:w-full ${active ? "border-primary bg-accent" : "border-transparent hover:border-primary/40"}`}
              disabled={busy}
              key={slide.id}
              onClick={() => setSelectedSlideId(slide.id)}
              type="button"
            >
              {slide.previewUrl ? <Image alt="" className="aspect-video w-full rounded border bg-white object-contain" decoding="async" fetchPriority="low" height={144} loading="lazy" src={slide.previewUrl} unoptimized width={256} /> : <span className="flex aspect-video items-center justify-center rounded border bg-background text-xs muted">暂无预览</span>}
              <span className="mt-2 flex items-center justify-between gap-1 text-xs"><strong>第 {slide.slideIndex + 1} 页</strong><span className="muted">{complete}/{total}</span></span>
              <span className="mt-1 block rounded-md bg-background px-1.5 py-1 text-center text-xs font-medium">{slideStatus(slide, isFilling)}</span>
              {slide.instances.length ? <span className="mt-1 block text-xs muted">{slide.instances.map((instance) => `${instance.assignee.name || instance.assignee.username}（${instance.assignee.employeeNumber}）`).join("、")}</span> : null}
            </button>;
          })}
        </div>
      </nav>

      <section aria-label="PPT 页面预览" className="min-w-0 rounded-xl border bg-card p-4">
        <h3 className="mb-3 text-lg font-semibold">PPT 页面预览</h3>
        {selectedSlide.previewUrl ? <PptPreviewImage
          alt={`第 ${selectedSlide.slideIndex + 1} 页 PPT 预览`}
          aspectRatio={selectedSlide.slideAspectRatio}
          key={selectedSlide.id}
          src={selectedSlide.previewUrl}
        /> : <div className="flex aspect-video items-center justify-center rounded border bg-background text-sm muted">暂无页面预览</div>}
      </section>

      <section aria-label={`第 ${selectedSlide.slideIndex + 1} 页${isFilling ? "填报情况" : "审核内容"}`} className="min-w-0 rounded-xl border bg-card p-5">
        <h3 className="text-lg font-semibold">第 {selectedSlide.slideIndex + 1} 页{isFilling ? "填报情况" : "审核"}</h3>
        <p className="mt-1 text-sm muted">{slideStatus(selectedSlide, isFilling)} · {isFilling ? `已提交 ${selectedSlide.instances.filter((instance) => instance.status === "SUBMITTED" || instance.status === "REVIEWED").length}/${selectedSlide.instances.length} 人` : `已确认 ${selectedSlide.placeholders.filter((placeholder) => placeholder.finalValue).length}/${selectedSlide.placeholders.length} 项`}</p>
        {selectedSlide.placeholders.length === 0 ? <p className="mt-4 rounded-md bg-accent p-3 text-sm">本页没有占位符，无需填报或审核。</p> : null}
        {selectedSlide.placeholders.length > 0 && selectedSlide.instances.length === 0 ? <p className="mt-4 rounded-md bg-accent p-3 text-sm">本页尚未分配填报人。</p> : null}
        {canSetValue && selectedSlide.placeholders.length > 0 ? <div className="mt-4 flex flex-wrap items-end gap-2 rounded-md border bg-background p-3">
          <AvailableMonthPicker label="指标月份" onAvailabilityChange={setMetricPeriodAvailable} onChange={(period) => { setMetricPeriod(period); setLoadedPeriod(""); setMetrics([]); setMetricChoices({}); }} periodsUrl="/api/metrics/periods" value={metricPeriod} />
          <Button disabled={busy || metricPeriodAvailable !== true} onClick={loadMetrics} size="sm" type="button" variant="outline">查询指标</Button>
        </div> : null}
        <div className="mt-4 space-y-2">{selectedSlide.instances.map((instance) => <div className="rounded-md border p-3 text-sm" key={instance.id}>
          <p>{instance.assignee.name || instance.assignee.username}（{instance.assignee.employeeNumber}） · {instanceStatusText[instance.status]}</p>
          {instance.status === "SUBMITTED" && canReview ? <div className="mt-2 flex flex-wrap gap-2">
            <input aria-label={`退回 ${instance.assignee.username} 的原因`} className="h-9 min-w-40 flex-1 rounded-md border bg-background px-2" onChange={(event) => setReasons({ ...reasons, [instance.id]: event.target.value })} placeholder="退回原因" value={reasons[instance.id] ?? ""} />
            <Button disabled={busy || !reasons[instance.id]?.trim()} onClick={() => mutate(`/api/report-tasks/${review.task.id}/fill-instances/${instance.id}/return`, "POST", { reason: reasons[instance.id] })} size="sm" type="button" variant="outline">退回</Button>
          </div> : null}
        </div>)}</div>
        <div className="mt-4 space-y-4">{selectedSlide.placeholders.map((placeholder) => <div className="rounded-md border p-3 text-sm" key={placeholder.id}>
          <p className="font-medium"><code>{`{{${placeholder.key}}}`}</code> #{placeholder.occurrenceIndex + 1} · {statusNames[placeholder.status]}</p>
          <div className="mt-2 space-y-2">{placeholder.submissions.map((submission) => <div className="rounded-md bg-background p-2" key={submission.id}>
            <p>{submission.assignee.name || submission.assignee.username} · 第 {submission.submissionRevision} 版：{submission.valueText}</p>
            {canReview ? <Button className="mt-2" disabled={busy} onClick={() => mutate(`/api/report-tasks/${review.task.id}/final-values/${placeholder.id}`, "PUT", { resolutionType: "SELECTED_SUBMISSION", selectedSubmittedValueId: submission.id })} size="sm" type="button" variant="outline">采用此值</Button> : null}
          </div>)}</div>
          {canSetValue ? <div className="mt-3 space-y-3 rounded-md border bg-background p-3">
            <p className="font-medium">收集人填写最终值</p>
            <div className="grid gap-2"><input aria-label={`手工最终值 ${placeholder.key}`} className="h-9 min-w-0 rounded-md border bg-background px-2" onChange={(event) => setManual({ ...manual, [placeholder.id]: event.target.value })} placeholder="人工输入值" value={manual[placeholder.id] ?? ""} /><Button disabled={busy || !manual[placeholder.id]?.trim()} onClick={() => mutate(`/api/report-tasks/${review.task.id}/final-values/${placeholder.id}`, "PUT", { resolutionType: "MANUAL", valueText: manual[placeholder.id] })} size="sm" type="button">保存人工值</Button></div>
            <div className="grid gap-2 border-t pt-3">
              {loadedPeriod === metricPeriod ? <><select aria-label={`选择指标 ${placeholder.key}`} className="h-9 min-w-0 rounded-md border bg-background px-2" onChange={(event) => setMetricChoices({ ...metricChoices, [placeholder.id]: event.target.value })} value={metricChoices[placeholder.id] ?? ""}><option value="">请选择指标</option>{metrics.map((metric) => <option key={metric.definitionId} value={metric.definitionId}>{metric.name}（{metric.code}）· {metric.valueText}{metric.unit ?? ""} · {metric.dataSource.name}</option>)}</select><Button disabled={busy || !metricChoices[placeholder.id]} onClick={() => mutate(`/api/report-tasks/${review.task.id}/final-values/${placeholder.id}`, "PUT", { resolutionType: "DATABASE_METRIC", metricDefinitionId: metricChoices[placeholder.id], metricPeriod })} size="sm" type="button" variant="outline">保存指标值</Button></> : <p className="text-xs muted">请先在上方选择有指标的月份并查询。</p>}
            </div>
          </div> : null}
          {placeholder.finalValue ? <p className="mt-3 rounded-md bg-accent p-2">最终值：{placeholder.finalValue.valueText} · {placeholder.finalValue.resolutionType === "MANUAL" ? "人工输入" : placeholder.finalValue.resolutionType === "DATABASE_METRIC" ? metricSourceLabel(placeholder.finalValue) : "采用提交值"}</p> : null}
        </div>)}</div>
        {message ? <p className="mt-4 text-sm" role="status">{message}</p> : null}
      </section>
    </div>}
  </section>;
}
