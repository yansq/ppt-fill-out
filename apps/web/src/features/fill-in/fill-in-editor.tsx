"use client";

import { useState } from "react";
import Image from "next/image";

import { Button } from "@report-platform/ui/button";

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
  task: { reportPeriod: string };
  placeholders: {
    id: string;
    key: string;
    occurrenceIndex: number;
    originalText: string;
    geometry: { left: number; top: number; width: number; height: number };
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

function bindingValue(binding: EditorInstance["bindings"][number] | undefined) {
  if (!binding) return "";
  if (binding.sourceType === "MANUAL_TEXT") return binding.manualValue ?? "";
  const snapshot = binding.sourceSnapshotJson as { valueText?: string } | null;
  return snapshot?.valueText ?? "";
}

export function FillInEditor({ initialInstance }: { initialInstance: EditorInstance }) {
  const [instance, setInstance] = useState(initialInstance);
  const [viewPeriod, setViewPeriod] = useState(initialInstance.task.reportPeriod);
  const [metrics, setMetrics] = useState<MetricOption[]>([]);
  const [loadedPeriod, setLoadedPeriod] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function loadMetrics() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/fill-instances/${instance.id}/metrics?period=${encodeURIComponent(viewPeriod)}`);
      const payload = await response.json() as { items?: MetricOption[]; error?: { message: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "指标加载失败");
      setMetrics(payload.items ?? []);
      setLoadedPeriod(viewPeriod);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "指标服务暂时不可用");
    } finally {
      setBusy(false);
    }
  }

  async function save(placeholderId: string, payload: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/fill-instances/${instance.id}/bindings/${placeholderId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, expectedVersion: instance.version })
      });
      const result = await response.json() as { instance?: EditorInstance; error?: { message: string } };
      if (!response.ok || !result.instance) throw new Error(result.error?.message ?? "保存失败");
      setInstance(result.instance);
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
      const response = await fetch(`/api/fill-instances/${instance.id}/submit`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: instance.version })
      });
      const result = await response.json() as { instance?: EditorInstance; error?: { message: string } };
      if (!response.ok || !result.instance) throw new Error(result.error?.message ?? "提交失败");
      setInstance(result.instance);
      setMessage("已提交；提交值已冻结，后续指标变化不会修改本次提交。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "提交失败");
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-8">
    <section className="rounded-lg border bg-card p-5">
      <h2 className="text-lg font-semibold">指标查看月份</h2>
      <p className="mt-1 text-sm">任务报告月份固定为 {instance.task.reportPeriod}；切换查看月份不会修改任务月份。</p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="grid gap-2 text-sm">查看月份<input className="h-10 rounded-md border bg-background px-3" onChange={(event) => { setViewPeriod(event.target.value); setLoadedPeriod(""); }} type="month" value={viewPeriod} /></label>
        <Button disabled={busy || !viewPeriod} onClick={loadMetrics} type="button" variant="outline">加载该月指标</Button>
        <span className="text-sm">{loadedPeriod === viewPeriod ? `${metrics.length} 个可用指标` : "尚未加载"}</span>
      </div>
      {viewPeriod !== instance.task.reportPeriod ? <p className="mt-3 rounded-md border border-primary bg-accent p-3 text-sm text-accent-foreground" role="alert">当前查看的是历史/其他月份 {viewPeriod}，不是任务报告月份 {instance.task.reportPeriod}。绑定后会保存实际指标月份。</p> : null}
      {loadedPeriod === viewPeriod && metrics.length > 0 ? <ul className="mt-4 grid gap-2 md:grid-cols-2">{metrics.map((metric) => <li className="rounded-md border p-3 text-sm" key={metric.definitionId}>
        <strong>{metric.name}</strong> · {metric.dataSource.name}<br />
        {metric.valueText}{metric.unit ? ` ${metric.unit}` : ""} · {metric.period} · v{metric.version}<br />
        更新：{metric.updatedBy} · {new Date(metric.updatedAt).toLocaleString("zh-CN")}
      </li>)}</ul> : null}
    </section>

    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-lg border bg-card p-5">
        <h2 className="mb-4 text-lg font-semibold">快速预览（位置近似）</h2>
        <div className="relative overflow-hidden rounded border">
          <Image alt="模板页快速预览" className="h-auto w-full" height={540} src={instance.previewUrl} unoptimized width={960} />
          {instance.placeholders.map((placeholder) => {
            const value = bindingValue(instance.bindings.find((binding) => binding.placeholderId === placeholder.id));
            return value ? <div className="fast-preview-field absolute overflow-hidden bg-card text-xs text-card-foreground" key={placeholder.id} style={{
              "--field-left": `${placeholder.geometry.left}%`, "--field-top": `${placeholder.geometry.top}%`,
              "--field-width": `${placeholder.geometry.width}%`, "--field-height": `${placeholder.geometry.height}%`
            } as React.CSSProperties}>{value}</div> : null;
          })}
        </div>
        <p className="mt-3 text-sm">此图仅辅助编辑；最终字体、换行和版式以 P6 真实预览为准。</p>
      </section>
      <section className="rounded-lg border bg-card p-5">
        <h2 className="mb-4 text-lg font-semibold">占位符草稿</h2>
        <div className="space-y-4">{instance.placeholders.map((placeholder) => <PlaceholderEditor
          binding={instance.bindings.find((binding) => binding.placeholderId === placeholder.id)}
          busy={busy || instance.status !== "IN_PROGRESS" || !instance.editable}
          key={placeholder.id}
          metrics={loadedPeriod === viewPeriod ? metrics : []}
          onSave={(payload) => save(placeholder.id, payload)}
          placeholder={placeholder}
          viewPeriod={viewPeriod}
        />)}</div>
        {instance.editable && instance.status === "IN_PROGRESS" ? <Button className="mt-6" disabled={busy || instance.bindings.length !== instance.placeholders.length} onClick={submit} type="button">提交本页</Button> : null}
        {instance.status === "SUBMITTED" ? <p className="mt-5 text-sm">本页已提交，当前不可编辑。</p> : null}
        {message ? <p className="mt-4 text-sm" role="status">{message}</p> : null}
      </section>
    </div>
  </div>;
}

function PlaceholderEditor({ placeholder, binding, metrics, viewPeriod, busy, onSave }: {
  placeholder: EditorInstance["placeholders"][number];
  binding: EditorInstance["bindings"][number] | undefined;
  metrics: MetricOption[];
  viewPeriod: string;
  busy: boolean;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const [sourceType, setSourceType] = useState(binding?.sourceType === "DATABASE_METRIC" ? "DATABASE_METRIC" : "MANUAL_TEXT");
  const [manualValue, setManualValue] = useState(binding?.manualValue ?? "");
  const [metricDefinitionId, setMetricDefinitionId] = useState(binding?.metricDefinitionId ?? "");
  const current = bindingValue(binding);

  return <div className="rounded-md border p-4 text-sm">
    <p className="font-semibold"><code>{`{{${placeholder.key}}}`}</code> #{placeholder.occurrenceIndex + 1}</p>
    <p className="mt-1">当前草稿：{current || "未填写"}{binding?.metricPeriod ? ` · 指标月份 ${binding.metricPeriod}` : ""}</p>
    <label className="mt-3 grid gap-2">来源
      <select className="h-10 rounded-md border bg-background px-3" disabled={busy} onChange={(event) => setSourceType(event.target.value)} value={sourceType}>
        <option value="MANUAL_TEXT">人工填写</option><option value="DATABASE_METRIC">数据库指标</option>
      </select>
    </label>
    {sourceType === "MANUAL_TEXT" ? <label className="mt-3 grid gap-2">内容<textarea className="min-h-20 rounded-md border bg-background p-3" disabled={busy} maxLength={2000} onChange={(event) => setManualValue(event.target.value)} value={manualValue} /></label> :
      <label className="mt-3 grid gap-2">{viewPeriod} 指标
        <select className="h-10 rounded-md border bg-background px-3" disabled={busy} onChange={(event) => setMetricDefinitionId(event.target.value)} value={metricDefinitionId}>
          <option value="">选择已加载指标</option>
          {metrics.map((metric) => <option key={metric.definitionId} value={metric.definitionId}>{metric.name} · {metric.valueText}{metric.unit ? ` ${metric.unit}` : ""}</option>)}
        </select>
      </label>}
    <Button className="mt-3" disabled={busy || (sourceType === "MANUAL_TEXT" ? !manualValue.trim() : !metricDefinitionId || metrics.length === 0)} onClick={() => onSave(sourceType === "MANUAL_TEXT"
      ? { sourceType, manualValue }
      : { sourceType, metricDefinitionId, metricPeriod: viewPeriod })} type="button" variant="outline">保存草稿</Button>
  </div>;
}
