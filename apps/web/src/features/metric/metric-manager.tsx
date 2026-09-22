"use client";

import { useState } from "react";

import { Button } from "@report-platform/ui/button";

type Metric = {
  definitionId: string; code: string; name: string; valueText: string;
  valueType: string; unit: string | null; period: string; version: number;
  updatedAt: string; updatedBy: string; dataSource: { id: string; name: string };
};

type History = {
  oldValueText: string; newValueText: string; oldVersion: number; newVersion: number;
  reason: string; updatedBy: string; updatedAt: string;
};

export function MetricManager({ initialPeriod }: { initialPeriod: string }) {
  const [period, setPeriod] = useState(initialPeriod);
  const [items, setItems] = useState<Metric[]>([]);
  const [loadedPeriod, setLoadedPeriod] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/metrics?period=${encodeURIComponent(period)}`);
      const payload = await response.json() as { items?: Metric[]; error?: { message: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "加载指标失败");
      setItems(payload.items ?? []);
      setLoadedPeriod(period);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "指标服务暂时不可用");
    } finally {
      setPending(false);
    }
  }

  function replace(updated: Metric) {
    setItems((previous) => previous.map((item) => item.definitionId === updated.definitionId ? updated : item));
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end gap-3">
      <label className="grid gap-2 text-sm">指标月份<input className="h-10 rounded-md border bg-background px-3" onChange={(event) => { setPeriod(event.target.value); setLoadedPeriod(""); }} type="month" value={period} /></label>
      <Button disabled={pending || !period} onClick={load} type="button">{pending ? "加载中…" : "查询指标"}</Button>
      {loadedPeriod === period ? <span className="text-sm">{items.length} 个指标</span> : null}
    </div>
    {message ? <p className="text-sm" role="status">{message}</p> : null}
    {loadedPeriod === period ? <div className="space-y-4">{items.map((item) => <MetricRow item={item} key={`${period}:${item.definitionId}`} onUpdated={replace} />)}</div> : null}
  </div>;
}

function MetricRow({ item, onUpdated }: { item: Metric; onUpdated: (metric: Metric) => void }) {
  const [value, setValue] = useState(item.valueText);
  const [reason, setReason] = useState("");
  const [history, setHistory] = useState<History[] | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function update() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/metrics/${item.definitionId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: item.period, value, reason, expectedVersion: item.version })
      });
      const payload = await response.json() as { metric?: Metric; error?: { message: string } };
      if (!response.ok || !payload.metric) throw new Error(payload.error?.message ?? "修改失败");
      onUpdated(payload.metric);
      setValue(payload.metric.valueText);
      setReason("");
      setHistory(null);
      setMessage("指标已更新并记录修改原因");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "指标修改失败");
    } finally {
      setPending(false);
    }
  }

  async function loadHistory() {
    setPending(true);
    try {
      const response = await fetch(`/api/metrics/${item.definitionId}/history?period=${encodeURIComponent(item.period)}`);
      const payload = await response.json() as { items?: History[]; error?: { message: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "加载历史失败");
      setHistory(payload.items ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "修改历史暂时不可用");
    } finally {
      setPending(false);
    }
  }

  async function reconcile() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/metrics/${item.definitionId}/reconcile`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: item.period })
      });
      const payload = await response.json() as { metric?: Metric; appliedChanges?: number; error?: { message: string } };
      if (!response.ok || !payload.metric) throw new Error(payload.error?.message ?? "同步失败");
      onUpdated(payload.metric);
      setValue(payload.metric.valueText);
      setMessage(`平台记录已同步 · 补记 ${payload.appliedChanges ?? 0} 条变更`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "同步失败");
    } finally {
      setPending(false);
    }
  }

  return <article className="rounded-lg border bg-card p-5">
    <h2 className="font-semibold">{item.name} <span className="text-sm font-normal">({item.code})</span></h2>
    <p className="mt-1 text-sm">{item.dataSource.name} · {item.period} · v{item.version} · 当前值 {item.valueText}{item.unit ? ` ${item.unit}` : ""}</p>
    <p className="mt-1 text-sm">最后更新：{item.updatedBy} · {new Date(item.updatedAt).toLocaleString("zh-CN")}</p>
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <label className="grid gap-2 text-sm">新值<input className="h-10 rounded-md border bg-background px-3" disabled={pending} maxLength={2000} onChange={(event) => setValue(event.target.value)} value={value} /></label>
      <label className="grid gap-2 text-sm">修改原因<input className="h-10 rounded-md border bg-background px-3" disabled={pending} maxLength={1000} onChange={(event) => setReason(event.target.value)} value={reason} /></label>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <Button disabled={pending || !value.trim() || reason.trim().length < 3} onClick={update} type="button" variant="outline">保存修改</Button>
      <Button disabled={pending} onClick={loadHistory} type="button" variant="outline">查看历史</Button>
      <Button disabled={pending} onClick={reconcile} type="button" variant="outline">同步平台记录</Button>
      {message ? <span className="text-sm" role="status">{message}</span> : null}
    </div>
    {history ? <ul className="mt-4 space-y-2 text-sm">{history.length ? history.map((entry) => <li className="rounded-md border p-3" key={`${entry.newVersion}:${entry.updatedAt}`}>
      v{entry.oldVersion} {entry.oldValueText} → v{entry.newVersion} {entry.newValueText} · {entry.reason} · {entry.updatedBy} · {new Date(entry.updatedAt).toLocaleString("zh-CN")}
    </li>) : <li>暂无修改历史</li>}</ul> : null}
  </article>;
}
