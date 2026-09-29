"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@report-platform/ui/button";
import { employeeDisplayName } from "../auth/employee-label";
import { instanceStatusText, taskStatusText } from "../../components/status";
import { PptPreviewImage } from "../fill-in/ppt-preview-image";
import { AvailableMonthPicker } from "../metric/available-month-picker";
import { MetricSelector } from "./metric-selector";
import { PageNavigationLayout } from "./page-navigation-layout";
import { PreviewEditorLayout } from "./preview-editor-layout";

import type { getReview } from "./review-service";

type Review = Awaited<ReturnType<typeof getReview>>;
const statusNames = {
  MISSING: "缺失",
  CONSISTENT: "一致",
  CONFLICT: "冲突",
} as const;

function metricSourceLabel(
  finalValue: Review["slides"][number]["placeholders"][number]["finalValue"],
) {
  if (finalValue?.resolutionType !== "DATABASE_METRIC") return null;
  const snapshot = finalValue.sourceSnapshotJson;
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot))
    return "数据库指标";
  const name =
    typeof snapshot.metricName === "string" ? snapshot.metricName : null;
  const period = typeof snapshot.period === "string" ? snapshot.period : null;
  return ["数据库指标", name, period].filter(Boolean).join(" · ");
}

function slideStatus(slide: Review["slides"][number], isFilling = false) {
  if (slide.placeholders.length === 0) return "无需填报";
  if (slide.instances.some((instance) => instance.status === "RETURNED"))
    return "已退回";
  if (slide.placeholders.every((placeholder) => placeholder.finalValue))
    return isFilling ? "收集人已填" : "审核完成";
  if (slide.instances.length === 0) return "收集人待填";
  if (
    slide.instances.every(
      (instance) =>
        instance.status === "SUBMITTED" || instance.status === "REVIEWED",
    )
  )
    return "待审核";
  return "填报中";
}

export function ReviewPanel({ initial }: { initial: Review }) {
  const router = useRouter();
  const [updatedReview, setReview] = useState<Review | null>(null);
  const review =
    updatedReview && updatedReview.task.version >= initial.task.version
      ? updatedReview
      : initial;
  const [selectedSlideId, setSelectedSlideId] = useState(
    initial.slides[0]?.id ?? "",
  );
  const [selectedPlaceholderId, setSelectedPlaceholderId] = useState("");
  const [sourceMode, setSourceMode] = useState<"manual" | "metric" | "ai">(
    "manual",
  );
  const [manual, setManual] = useState<Record<string, string>>({});
  const [aiPrompts, setAiPrompts] = useState<Record<string, string>>({});
  const [aiGenerationIds, setAiGenerationIds] = useState<
    Record<string, string>
  >({});
  const [metricPeriod, setMetricPeriod] = useState(initial.task.reportPeriod);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function mutate(
    path: string,
    method: "PUT" | "POST",
    body: Record<string, unknown>,
  ) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, expectedVersion: review.task.version }),
      });
      const result = (await response.json()) as Review & {
        error?: { message: string };
      };
      if (!response.ok)
        throw new Error(result.error?.message ?? "审核操作失败");
      setReview(result);
      setMessage(
        result.task.status === "COMPLETED"
          ? "审核已完成，请进入生成与导出页面。"
          : result.task.status === "REVIEWING" && review.task.status === "FILLING"
            ? "收集人填写已提交，请完成审核。"
          : "已保存当前页的最终值",
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "审核操作失败");
    } finally {
      setBusy(false);
    }
  }

  async function generateAiCandidate(placeholderId: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/report-tasks/${review.task.id}/ai-generations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            placeholderId,
            prompt:
              aiPrompts[placeholderId]?.trim() ||
              "根据报告月份、占位符上下文和已有提交值，生成一段适合放入报告的简洁文本。",
          }),
        },
      );
      const result = (await response.json()) as {
        candidate?: { id: string; outputText: string };
        error?: { message: string };
      };
      if (!response.ok || !result.candidate)
        throw new Error(result.error?.message ?? "AI 候选生成失败");
      setManual((previous) => ({
        ...previous,
        [placeholderId]: result.candidate!.outputText,
      }));
      setAiGenerationIds((previous) => ({
        ...previous,
        [placeholderId]: result.candidate!.id,
      }));
      setSourceMode("manual");
      setMessage("AI 候选已填入人工值，请检查和修改后保存。 ");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI 候选生成失败");
    } finally {
      setBusy(false);
    }
  }

  const canReview = review.task.status === "REVIEWING";
  const isFilling = review.task.status === "FILLING";
  const canSetValue = canReview || isFilling;
  const collectorOnly = review.slides.every((slide) => slide.instances.length === 0);
  const requiredCount = review.slides.reduce(
    (count, slide) => count + slide.placeholders.length,
    0,
  );
  const decidedCount = review.slides.reduce(
    (count, slide) =>
      count +
      slide.placeholders.filter((placeholder) => placeholder.finalValue).length,
    0,
  );
  const selectedSlide =
    review.slides.find((slide) => slide.id === selectedSlideId) ??
    review.slides[0];
  const selectedPlaceholder =
    selectedSlide?.placeholders.find(
      (placeholder) => placeholder.id === selectedPlaceholderId,
    ) ??
    selectedSlide?.placeholders.find(
      (placeholder) => !placeholder.finalValue,
    ) ??
    selectedSlide?.placeholders[0];
  const selectedPlaceholderNumber =
    selectedSlide && selectedPlaceholder
      ? selectedSlide.placeholders.findIndex(
          (placeholder) => placeholder.id === selectedPlaceholder.id,
        ) + 1
      : 0;
  const fieldNavigation = selectedSlide?.placeholders.length ? (
    <section aria-label="本页填报项" className="review-field-nav-panel">
      <div className="review-field-list-heading">
        <strong>选择填报项</strong>
        <span>
          共 {selectedSlide.placeholders.length} 项 · 当前{" "}
          {selectedPlaceholderNumber}/{selectedSlide.placeholders.length}
        </span>
      </div>
      <div aria-label="本页填报项" className="review-field-list" role="group">
        {selectedSlide.placeholders.map((placeholder, index) => (
          <button
            aria-label={`查看填报项 ${placeholder.key} 第 ${placeholder.occurrenceIndex + 1} 处`}
            aria-pressed={placeholder.id === selectedPlaceholder?.id}
            className="review-field-tab"
            data-complete={Boolean(placeholder.finalValue)}
            key={placeholder.id}
            onClick={() => {
              setSelectedPlaceholderId(placeholder.id);
              setSourceMode("manual");
            }}
            type="button"
          >
            <span className="review-field-index">{index + 1}</span>
            <span className="review-field-name">
              <strong>
                {`{{${placeholder.key}}}`} #{placeholder.occurrenceIndex + 1}
              </strong>
              <small>
                {placeholder.finalValue
                  ? "已有最终值"
                  : statusNames[placeholder.status]}
              </small>
            </span>
          </button>
        ))}
      </div>
    </section>
  ) : null;
  const fillRecords = selectedSlide?.instances.length ? (
    <details className="review-records">
      <summary>
        填报记录 <span>{selectedSlide.instances.length} 人</span>
      </summary>
      <div className="review-records-list">
        {selectedSlide.instances.map((instance) => (
          <div className="review-record" key={instance.id}>
            <p>
              {employeeDisplayName(instance.assignee)}（
              {instance.assignee.employeeNumber}） ·{" "}
              {instanceStatusText[instance.status]}
            </p>
            {instance.status === "SUBMITTED" && canReview ? (
              <div className="review-return">
                <input
                  aria-label={`退回 ${employeeDisplayName(instance.assignee)} 的原因`}
                  className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2"
                  onChange={(event) =>
                    setReasons({
                      ...reasons,
                      [instance.id]: event.target.value,
                    })
                  }
                  placeholder="退回原因"
                  value={reasons[instance.id] ?? ""}
                />
                <Button
                  disabled={busy || !reasons[instance.id]?.trim()}
                  onClick={() =>
                    mutate(
                      `/api/report-tasks/${review.task.id}/fill-instances/${instance.id}/return`,
                      "POST",
                      { reason: reasons[instance.id] },
                    )
                  }
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  退回
                </Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </details>
  ) : null;

  return (
    <section className="review-panel">
      {isFilling && collectorOnly ? (
        <div className="review-overview">
          <p>{`收集人自填 · 已填写 ${decidedCount}/${requiredCount} 项`}</p>
          <Button
            disabled={busy || requiredCount === 0 || decidedCount !== requiredCount}
            onClick={() => mutate(`/api/report-tasks/${review.task.id}/submit-collector`, "POST", {})}
            type="button"
          >
            提交收集人填写
          </Button>
        </div>
      ) : null}
      {!isFilling ? (
        <div className="review-overview">
          <p>{`已确认 ${decidedCount}/${requiredCount} 项 · ${taskStatusText[review.task.status]}`}</p>
          <div className="review-overview-actions">
            {canReview ? (
              <Button
                disabled={
                  busy || requiredCount === 0 || decidedCount !== requiredCount
                }
                onClick={() =>
                  mutate(
                    `/api/report-tasks/${review.task.id}/review`,
                    "POST",
                    {},
                  )
                }
                type="button"
              >
                完成审核
              </Button>
            ) : review.task.status === "COMPLETED" ||
              review.task.status === "EXPORTED" ? (
              <span className="status-pill">审核已完成</span>
            ) : null}
            {review.task.status === "COMPLETED" ||
            review.task.status === "EXPORTED" ? (
              <Button asChild>
                <a href={`/report-tasks/${review.task.id}/generation`}>
                  生成与导出
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {!selectedSlide ? (
        <p className="rounded-xl border bg-card p-5 text-sm">模板暂无页面。</p>
      ) : (
        <PageNavigationLayout label={isFilling ? "填报工作区" : "审核工作区"}>
          <nav
            aria-label={isFilling ? "填报页面导航" : "审核页面导航"}
            className="review-page-nav"
          >
            <div className="review-page-nav-heading">
              <strong>报告页面</strong>
              <span>共 {review.slides.length} 页</span>
            </div>
            <div className="review-page-nav-list">
              {review.slides.map((slide) => {
                const active = slide.id === selectedSlide.id;
                const complete = isFilling && slide.instances.length > 0
                  ? slide.instances.filter(
                      (instance) =>
                        instance.status === "SUBMITTED" ||
                        instance.status === "REVIEWED",
                    ).length
                  : slide.placeholders.filter(
                      (placeholder) => placeholder.finalValue,
                    ).length;
                const total = isFilling && slide.instances.length > 0
                  ? slide.instances.length
                  : slide.placeholders.length;
                return (
                  <button
                    aria-label={`${isFilling ? "查看" : "审核"}第 ${slide.slideIndex + 1} 页`}
                    aria-pressed={active}
                    className="review-page-nav-item"
                    disabled={busy}
                    key={slide.id}
                    onClick={() => {
                      setSelectedSlideId(slide.id);
                      setSelectedPlaceholderId("");
                      setSourceMode("manual");
                    }}
                    type="button"
                  >
                    {slide.previewUrl ? (
                      <span className="review-page-nav-thumb">
                        <Image
                          alt=""
                          className="h-full w-full object-contain"
                          height={81}
                          loading="lazy"
                          src={slide.previewUrl}
                          unoptimized
                          width={144}
                        />
                      </span>
                    ) : (
                      <span className="review-page-nav-thumb review-page-nav-thumb-empty">
                        暂无预览
                      </span>
                    )}
                    <span className="review-page-nav-meta">
                      <strong>第 {slide.slideIndex + 1} 页</strong>
                      <span className="review-page-nav-count">
                        {complete}/{total}
                      </span>
                    </span>
                    <span className="review-page-nav-status">
                      {slideStatus(slide, isFilling)}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>
          <PreviewEditorLayout
            preview={
              <section
                aria-label="PPT 页面预览"
                className="review-preview-panel"
              >
                <div className="review-panel-heading">
                  <div>
                    <h3>第 {selectedSlide.slideIndex + 1} 页预览</h3>
                  </div>
                </div>
                {selectedSlide.previewUrl ? (
                  <PptPreviewImage
                    alt={`第 ${selectedSlide.slideIndex + 1} 页 PPT 预览`}
                    aspectRatio={selectedSlide.slideAspectRatio}
                    key={selectedSlide.id}
                    src={selectedSlide.previewUrl}
                  />
                ) : (
                  <div className="flex aspect-video items-center justify-center rounded border bg-background text-sm muted">
                    暂无页面预览
                  </div>
                )}
              </section>
            }
            editor={
              <section
                aria-label={`第 ${selectedSlide.slideIndex + 1} 页${isFilling ? "填报情况" : "审核内容"}`}
                className="review-editor-panel"
              >
                <div className="review-panel-heading">
                  <div>
                    <h3>
                      第 {selectedSlide.slideIndex + 1} 页
                      {isFilling ? "填报情况" : "审核"}
                    </h3>
                    <p>
                      {isFilling && selectedSlide.instances.length > 0
                        ? `已提交 ${selectedSlide.instances.filter((instance) => instance.status === "SUBMITTED" || instance.status === "REVIEWED").length}/${selectedSlide.instances.length} 人`
                        : `已填写 ${selectedSlide.placeholders.filter((placeholder) => placeholder.finalValue).length}/${selectedSlide.placeholders.length} 项`}
                    </p>
                  </div>
                  <span className="status-pill">
                    {slideStatus(selectedSlide, isFilling)}
                  </span>
                </div>
                {selectedSlide.placeholders.length === 0 ? (
                  <p className="review-empty-note">
                    本页没有占位符，无需填报或审核。
                  </p>
                ) : (
                  <>
                    {fieldNavigation}
                    {selectedSlide.instances.length === 0 ? (
                      <p className="review-empty-note">本页由收集人填写，无需分配填报人。</p>
                    ) : null}
                    {!isFilling ? fillRecords : null}
                    {selectedPlaceholder ? (
                      <div
                        className="review-field-detail"
                        key={selectedPlaceholder.id}
                      >
                        <div className="review-field-detail-heading">
                          <div>
                            <span>当前填报项</span>
                            <h4>
                              <code>{`{{${selectedPlaceholder.key}}}`}</code> #
                              {selectedPlaceholder.occurrenceIndex + 1}
                            </h4>
                          </div>
                          <span className="status-pill">
                            {selectedPlaceholder.finalValue
                              ? "已确认"
                              : statusNames[selectedPlaceholder.status]}
                          </span>
                        </div>
                        {selectedPlaceholder.finalValue ? (
                          <div className="review-final-value">
                            <span>
                              当前最终值 ·{" "}
                              {selectedPlaceholder.finalValue.resolutionType ===
                              "MANUAL"
                                ? "人工输入"
                                : selectedPlaceholder.finalValue
                                      .resolutionType === "DATABASE_METRIC"
                                  ? metricSourceLabel(
                                      selectedPlaceholder.finalValue,
                                    )
                                  : "采用提交值"}
                            </span>
                            <p>
                              最终值：{selectedPlaceholder.finalValue.valueText}
                            </p>
                          </div>
                        ) : null}
                        {selectedPlaceholder.submissions.length > 0 ? (
                          <details
                            className="review-submissions"
                            open={canReview}
                          >
                            <summary>
                              已提交内容{" "}
                              <span>
                                {selectedPlaceholder.submissions.length} 条
                              </span>
                            </summary>
                            <div className="review-submissions-list">
                              {selectedPlaceholder.submissions.map(
                                (submission) => (
                                  <div
                                    className="review-submission"
                                    key={submission.id}
                                  >
                                    <p className="review-submission-source">
                                      {employeeDisplayName(submission.assignee)}{" "}
                                      · 第 {submission.submissionRevision} 版
                                    </p>
                                    <p className="review-submission-value">
                                      {submission.valueText}
                                    </p>
                                    {canReview ? (
                                      <Button
                                        disabled={busy}
                                        onClick={() =>
                                          mutate(
                                            `/api/report-tasks/${review.task.id}/final-values/${selectedPlaceholder.id}`,
                                            "PUT",
                                            {
                                              resolutionType:
                                                "SELECTED_SUBMISSION",
                                              selectedSubmittedValueId:
                                                submission.id,
                                            },
                                          )
                                        }
                                        size="sm"
                                        type="button"
                                        variant="outline"
                                      >
                                        采用此值
                                      </Button>
                                    ) : null}
                                  </div>
                                ),
                              )}
                            </div>
                          </details>
                        ) : null}
                        {canSetValue ? (
                          <div className="review-value-editor">
                            <div
                              aria-label="最终值来源"
                              className="review-source-switch"
                              role="group"
                            >
                              <button
                                aria-pressed={sourceMode === "manual"}
                                onClick={() => setSourceMode("manual")}
                                type="button"
                              >
                                手工填写
                              </button>
                              <button
                                aria-pressed={sourceMode === "metric"}
                                onClick={() => setSourceMode("metric")}
                                type="button"
                              >
                                引用指标
                              </button>
                              <button
                                aria-pressed={sourceMode === "ai"}
                                onClick={() => setSourceMode("ai")}
                                type="button"
                              >
                                AI 辅助
                              </button>
                            </div>
                            {sourceMode === "manual" ? (
                              <div className="review-source-content">
                                <label className="grid gap-2 text-sm font-medium">
                                  最终值
                                  <textarea
                                    aria-label={`手工最终值 ${selectedPlaceholder.key}`}
                                    className="review-value-textarea"
                                    onChange={(event) =>
                                      setManual({
                                        ...manual,
                                        [selectedPlaceholder.id]:
                                          event.target.value,
                                      })
                                    }
                                    placeholder="输入最终写入 PPT 的内容"
                                    value={manual[selectedPlaceholder.id] ?? ""}
                                  />
                                </label>
                                <Button
                                  disabled={
                                    busy ||
                                    !manual[selectedPlaceholder.id]?.trim()
                                  }
                                  onClick={() =>
                                    mutate(
                                      `/api/report-tasks/${review.task.id}/final-values/${selectedPlaceholder.id}`,
                                      "PUT",
                                      {
                                        resolutionType: "MANUAL",
                                        valueText:
                                          manual[selectedPlaceholder.id],
                                        aiGenerationId:
                                          aiGenerationIds[
                                            selectedPlaceholder.id
                                          ],
                                      },
                                    )
                                  }
                                  size="sm"
                                  type="button"
                                >
                                  保存人工值
                                </Button>
                              </div>
                            ) : null}
                            {sourceMode === "metric" ? (
                              <div className="review-source-content">
                                <AvailableMonthPicker
                                  inline
                                  label="指标月份"
                                  onChange={setMetricPeriod}
                                  periodsUrl="/api/metrics/periods"
                                  value={metricPeriod}
                                />
                                <MetricSelector
                                  busy={busy}
                                  key={`${selectedPlaceholder.id}-${metricPeriod}`}
                                  onSave={(definitionId) =>
                                    mutate(
                                      `/api/report-tasks/${review.task.id}/final-values/${selectedPlaceholder.id}`,
                                      "PUT",
                                      {
                                        resolutionType: "DATABASE_METRIC",
                                        metricDefinitionId: definitionId,
                                        metricPeriod,
                                      },
                                    )
                                  }
                                  period={metricPeriod}
                                />
                              </div>
                            ) : null}
                            {sourceMode === "ai" ? (
                              <div className="review-source-content">
                                <p className="text-sm muted">
                                  生成的内容会先放入手工填写区，请检查后保存。
                                </p>
                                <label className="grid gap-2 text-sm font-medium">
                                  AI 生成提示词
                                  <textarea
                                    aria-label={`AI 提示词 ${selectedPlaceholder.key}`}
                                    className="review-value-textarea"
                                    maxLength={4000}
                                    onChange={(event) =>
                                      setAiPrompts((previous) => ({
                                        ...previous,
                                        [selectedPlaceholder.id]:
                                          event.target.value,
                                      }))
                                    }
                                    placeholder="可选：说明语气、内容或关注点"
                                    value={
                                      aiPrompts[selectedPlaceholder.id] ?? ""
                                    }
                                  />
                                </label>
                                <Button
                                  disabled={busy}
                                  onClick={() =>
                                    void generateAiCandidate(
                                      selectedPlaceholder.id,
                                    )
                                  }
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                >
                                  生成 AI 候选
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {isFilling ? fillRecords : null}
                  </>
                )}
                {message ? (
                  <p className="review-feedback" role="status">
                    {message}
                  </p>
                ) : null}
              </section>
            }
          />
        </PageNavigationLayout>
      )}
    </section>
  );
}
