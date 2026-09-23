"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { Button } from "@report-platform/ui/button";
import { AvailableMonthPicker } from "../metric/available-month-picker";

import {
  FillPageNavigation,
  type FillPageNavigationData,
} from "./page-navigation";
import { PptPreviewImage } from "./ppt-preview-image";

type MetricOption = {
  definitionId: string;
  code: string;
  name: string;
  dataSource: { id: string; name: string };
  valueText: string;
  unit: string | null;
  period: string;
  updatedAt: string;
  updatedBy: string;
  version: number;
};

type EditorInstance = {
  id: string;
  status: string;
  version: number;
  editable: boolean;
  previewUrl: string;
  draftPreviewUrl: string;
  slideAspectRatio: number;
  task: { id: string; reportPeriod: string };
  placeholders: {
    id: string;
    key: string;
    occurrenceIndex: number;
    originalText: string;
  }[];
  bindings: {
    placeholderId: string;
    sourceType: string;
    manualValue: string | null;
    metricDefinitionId: string | null;
    metricPeriod: string | null;
    sourceSnapshotJson: unknown;
  }[];
};

const metricPeriodKey = (taskId: string) => `fill-metric-period:${taskId}`;
const metricCacheKey = (taskId: string, period: string) =>
  `fill-metrics:${taskId}:${period}`;

function readSavedMetricPeriod(taskId: string) {
  try {
    const period = window.sessionStorage.getItem(metricPeriodKey(taskId));
    return period && /^\d{4}-(0[1-9]|1[0-2])$/.test(period) ? period : null;
  } catch {
    return null;
  }
}

function readMetricCache(taskId: string, period: string) {
  try {
    const value = window.sessionStorage.getItem(metricCacheKey(taskId, period));
    if (!value) return null;
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as MetricOption[]) : null;
  } catch {
    return null;
  }
}

function saveMetricSession(
  taskId: string,
  period: string,
  items?: MetricOption[],
) {
  try {
    window.sessionStorage.setItem(metricPeriodKey(taskId), period);
    if (items) {
      window.sessionStorage.setItem(
        metricCacheKey(taskId, period),
        JSON.stringify(items),
      );
    }
  } catch {
    // Session storage is only an optimization; loading still works when it is unavailable.
  }
}

function bindingValue(binding: EditorInstance["bindings"][number] | undefined) {
  if (!binding) return "";
  if (binding.sourceType === "MANUAL_TEXT") return binding.manualValue ?? "";
  const snapshot = binding.sourceSnapshotJson as { valueText?: string } | null;
  return snapshot?.valueText ?? "";
}

export function FillInEditor({
  initialInstance,
  navigation,
}: {
  initialInstance: EditorInstance;
  navigation: FillPageNavigationData | null;
}) {
  const [instance, setInstance] = useState(initialInstance);
  const [viewPeriod, setViewPeriod] = useState(
    initialInstance.task.reportPeriod,
  );
  const [metrics, setMetrics] = useState<MetricOption[]>([]);
  const [loadedPeriod, setLoadedPeriod] = useState("");
  const [periodAvailable, setPeriodAvailable] = useState<boolean | null>(null);
  const [metricError, setMetricError] = useState("");
  const [metricRetry, setMetricRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [allPagesSubmitted, setAllPagesSubmitted] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const previewRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const period =
        readSavedMetricPeriod(initialInstance.task.id) ??
        initialInstance.task.reportPeriod;
      const cached = readMetricCache(initialInstance.task.id, period);
      setViewPeriod(period);
      setMetrics(cached ?? []);
      setLoadedPeriod(cached ? period : "");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialInstance.task.id, initialInstance.task.reportPeriod]);

  useEffect(() => {
    if (periodAvailable !== true || loadedPeriod === viewPeriod) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(
          `/api/fill-instances/${instance.id}/metrics?period=${encodeURIComponent(viewPeriod)}`,
          { signal: controller.signal },
        );
        const payload = (await response.json()) as {
          items?: MetricOption[];
          error?: { message: string };
        };
        if (!response.ok)
          throw new Error(payload.error?.message ?? "指标加载失败");
        if (controller.signal.aborted) return;
        const items = payload.items ?? [];
        setMetrics(items);
        setLoadedPeriod(viewPeriod);
        saveMetricSession(instance.task.id, viewPeriod, items);
      } catch (error) {
        if (!controller.signal.aborted)
          setMetricError(error instanceof Error ? error.message : "指标服务暂时不可用");
      }
    })();
    return () => controller.abort();
  }, [instance.id, instance.task.id, loadedPeriod, metricRetry, periodAvailable, viewPeriod]);

  function locatePlaceholder(placeholderId: string) {
    if (highlightedId === placeholderId) {
      setHighlightedId(null);
      return;
    }
    setHighlightedId(placeholderId);
    const preview = previewRef.current;
    if (preview) {
      const bounds = preview.getBoundingClientRect();
      if (bounds.bottom < 0 || bounds.top > window.innerHeight) {
        preview.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }

  function markDirty(placeholderId: string) {
    setDirtyIds((previous) => new Set(previous).add(placeholderId));
  }

  function changeViewPeriod(period: string) {
    const cached = readMetricCache(instance.task.id, period);
    setPeriodAvailable(null);
    setMetricError("");
    setViewPeriod(period);
    setMetrics(cached ?? []);
    setLoadedPeriod(cached ? period : "");
    saveMetricSession(instance.task.id, period);
  }

  async function save(placeholderId: string, payload: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/fill-instances/${instance.id}/bindings/${placeholderId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            expectedVersion: instance.version,
          }),
        },
      );
      const result = (await response.json()) as {
        instance?: EditorInstance;
        error?: { message: string };
      };
      if (!response.ok || !result.instance)
        throw new Error(result.error?.message ?? "保存失败");
      setInstance(result.instance);
      setDirtyIds((previous) => {
        const next = new Set(previous);
        next.delete(placeholderId);
        return next;
      });
      setMessage("草稿已保存");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "草稿保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/fill-instances/${instance.id}/submit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expectedVersion: instance.version }),
        },
      );
      const result = (await response.json()) as {
        instance?: EditorInstance;
        allAssignedPagesSubmitted?: boolean;
        error?: { message: string };
      };
      if (!response.ok || !result.instance)
        throw new Error(result.error?.message ?? "提交失败");
      setInstance(result.instance);
      setMessage("已提交；提交值已冻结，后续指标变化不会修改本次提交。");
      setAllPagesSubmitted(result.allAssignedPagesSubmitted === true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "提交失败");
    } finally {
      setBusy(false);
    }
  }

  const previewUrl = highlightedId
    ? `${instance.draftPreviewUrl}&highlight=${encodeURIComponent(highlightedId)}`
    : instance.draftPreviewUrl;

  return (
    <>
      {allPagesSubmitted ? (
        <FillCompletionDialog onClose={() => setAllPagesSubmitted(false)} />
      ) : null}
      <div className={`fill-page-grid ${navigation ? "has-page-nav" : ""}`}>
        {navigation ? (
          <FillPageNavigation
            currentStatus={instance.status}
            navigation={navigation}
            pending={busy}
            unsaved={dirtyIds.size > 0}
          />
        ) : null}
        <div className="min-w-0 space-y-5">
          <section className="rounded-xl border bg-card p-4" ref={previewRef}>
            <h2 className="mb-3 text-lg font-semibold">PPT 页面预览</h2>
            <PptPreviewImage
              alt="当前 PPT 页的填报草稿预览"
              fallbackSrc={
                highlightedId ? instance.draftPreviewUrl : instance.previewUrl
              }
              aspectRatio={instance.slideAspectRatio}
              key={previewUrl}
              src={previewUrl}
            />
          </section>
          <section className="rounded-xl border bg-card p-5">
            <h2 className="text-lg font-semibold">引用数据库指标</h2>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <AvailableMonthPicker label="查看月份" onAvailabilityChange={setPeriodAvailable} onChange={changeViewPeriod} periodsUrl={`/api/fill-instances/${instance.id}/metric-periods`} value={viewPeriod} />
              <span className="text-sm">
                {loadedPeriod === viewPeriod
                  ? `${metrics.length} 个可用指标`
                  : periodAvailable === false ? "该月份暂无可用指标" : metricError ? "指标加载失败" : "正在加载该月指标…"}
              </span>
              {metricError ? <Button onClick={() => { setMetricError(""); setMetricRetry((previous) => previous + 1); }} type="button" variant="outline">重试</Button> : null}
            </div>
            {metricError ? <p className="mt-2 text-sm" role="alert">{metricError}</p> : null}
            {viewPeriod !== instance.task.reportPeriod ? (
              <p
                className="mt-3 rounded-md border border-primary bg-accent p-3 text-sm text-accent-foreground"
                role="alert"
              >
                当前查看的是历史/其他月份 {viewPeriod}，不是任务报告月份{" "}
                {instance.task.reportPeriod}。绑定后会保存实际指标月份。
              </p>
            ) : null}
            {loadedPeriod === viewPeriod && metrics.length > 0 ? (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium">
                  查看已加载指标
                </summary>
                <ul className="mt-3 grid gap-2">
                  {metrics.map((metric) => (
                    <li
                      className="rounded-md border p-3 text-sm"
                      key={metric.definitionId}
                    >
                      <strong>{metric.name}</strong> · {metric.dataSource.name}
                      <br />
                      {metric.valueText}
                      {metric.unit ? ` ${metric.unit}` : ""} · {metric.period} ·
                      v{metric.version}
                      <br />
                      更新：{metric.updatedBy} ·{" "}
                      {new Date(metric.updatedAt).toLocaleString("zh-CN")}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </section>
        </div>

        <div className="min-w-0 space-y-5">
          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-4 text-lg font-semibold">填写内容</h2>
            <div className="space-y-4">
              {instance.placeholders.map((placeholder) => (
                <PlaceholderEditor
                  binding={instance.bindings.find(
                    (binding) => binding.placeholderId === placeholder.id,
                  )}
                  busy={
                    busy ||
                    instance.status !== "IN_PROGRESS" ||
                    !instance.editable
                  }
                  key={placeholder.id}
                  metrics={loadedPeriod === viewPeriod ? metrics : []}
                  highlighted={highlightedId === placeholder.id}
                  onDirty={() => markDirty(placeholder.id)}
                  onLocate={() => locatePlaceholder(placeholder.id)}
                  onSave={(payload) => save(placeholder.id, payload)}
                  placeholder={placeholder}
                  viewPeriod={viewPeriod}
                />
              ))}
            </div>
            {instance.editable && instance.status === "IN_PROGRESS" ? (
              <Button
                className="mt-6"
                disabled={
                  busy ||
                  dirtyIds.size > 0 ||
                  instance.bindings.length !== instance.placeholders.length
                }
                onClick={submit}
                type="button"
              >
                提交本页
              </Button>
            ) : null}
            {instance.status === "SUBMITTED" ? (
              <p className="mt-5 text-sm">本页已提交，当前不可编辑。</p>
            ) : null}
            {message ? (
              <p className="mt-4 text-sm" role="status">
                {message}
              </p>
            ) : null}
          </section>
        </div>
      </div>
    </>
  );
}

function FillCompletionDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      aria-describedby="fill-completion-description"
      aria-labelledby="fill-completion-title"
      className="w-full max-w-md rounded-xl border bg-card p-6 text-foreground shadow-xl backdrop:bg-black/50"
      onClose={onClose}
      ref={dialogRef}
    >
      <h2 className="text-xl font-semibold" id="fill-completion-title">
        已完成填报
      </h2>
      <p className="mt-3 text-sm muted" id="fill-completion-description">
        这份报告分配给你的页面均已提交，请等待收集人审核。
      </p>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button
          onClick={() => dialogRef.current?.close()}
          type="button"
          variant="outline"
        >
          留在本页
        </Button>
        <Button asChild>
          <Link href="/">返回工作台</Link>
        </Button>
      </div>
    </dialog>
  );
}

function PlaceholderEditor({
  placeholder,
  binding,
  metrics,
  viewPeriod,
  busy,
  highlighted,
  onDirty,
  onLocate,
  onSave,
}: {
  placeholder: EditorInstance["placeholders"][number];
  binding: EditorInstance["bindings"][number] | undefined;
  metrics: MetricOption[];
  viewPeriod: string;
  busy: boolean;
  highlighted: boolean;
  onDirty: () => void;
  onLocate: () => void;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const [sourceType, setSourceType] = useState(
    binding?.sourceType === "DATABASE_METRIC"
      ? "DATABASE_METRIC"
      : "MANUAL_TEXT",
  );
  const [manualValue, setManualValue] = useState(binding?.manualValue ?? "");
  const [metricDefinitionId, setMetricDefinitionId] = useState(
    binding?.metricDefinitionId ?? "",
  );
  const current = bindingValue(binding);

  return (
    <div
      className={`rounded-md border p-4 text-sm ${highlighted ? "border-primary bg-accent/30" : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">
          <code>{`{{${placeholder.key}}}`}</code> #
          {placeholder.occurrenceIndex + 1}
        </p>
        <Button
          aria-pressed={highlighted}
          onClick={onLocate}
          size="sm"
          type="button"
          variant="outline"
        >
          {highlighted ? "取消高亮" : "高亮文字"}
        </Button>
      </div>
      <p className="mt-1">
        当前草稿：{current || "未填写"}
        {binding?.metricPeriod ? ` · 指标月份 ${binding.metricPeriod}` : ""}
      </p>
      <label className="mt-3 grid gap-2">
        来源
        <select
          className="h-10 rounded-md border bg-background px-3"
          disabled={busy}
          onChange={(event) => {
            setSourceType(event.target.value);
            onDirty();
          }}
          value={sourceType}
        >
          <option value="MANUAL_TEXT">人工填写</option>
          <option value="DATABASE_METRIC">数据库指标</option>
        </select>
      </label>
      {sourceType === "MANUAL_TEXT" ? (
        <label className="mt-3 grid gap-2">
          内容
          <textarea
            className="min-h-20 rounded-md border bg-background p-3"
            disabled={busy}
            maxLength={2000}
            onChange={(event) => {
              setManualValue(event.target.value);
              onDirty();
            }}
            value={manualValue}
          />
        </label>
      ) : (
        <label className="mt-3 grid gap-2">
          {viewPeriod} 指标
          <select
            className="h-10 rounded-md border bg-background px-3"
            disabled={busy}
            onChange={(event) => {
              setMetricDefinitionId(event.target.value);
              onDirty();
            }}
            value={metricDefinitionId}
          >
            <option value="">选择已加载指标</option>
            {metrics.map((metric) => (
              <option key={metric.definitionId} value={metric.definitionId}>
                {metric.name} · {metric.valueText}
                {metric.unit ? ` ${metric.unit}` : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      <Button
        className="mt-3"
        disabled={
          busy ||
          (sourceType === "MANUAL_TEXT"
            ? !manualValue.trim()
            : !metricDefinitionId || metrics.length === 0)
        }
        onClick={() =>
          onSave(
            sourceType === "MANUAL_TEXT"
              ? { sourceType, manualValue }
              : { sourceType, metricDefinitionId, metricPeriod: viewPeriod },
          )
        }
        type="button"
        variant="outline"
      >
        保存草稿
      </Button>
    </div>
  );
}
