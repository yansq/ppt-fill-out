"use client";

import { Fragment, useEffect, useState } from "react";

import { Button } from "@report-platform/ui/button";
import { Select } from "@report-platform/ui/select";
import { AvailableMonthPicker } from "./available-month-picker";

type Metric = {
  definitionId: string; code: string; name: string; valueText: string;
  valueType: string; unit: string | null; period: string; version: number;
  updatedAt: string; updatedBy: string; dataSource: { id: string; name: string };
};

type CatalogItem = {
  definitionId: string;
  code: string;
  name: string;
  valueType: string;
  unit: string | null;
  dataSource: { id: string; name: string };
  writable: boolean;
  manual: boolean;
  metric: Metric | null;
};

type CatalogResult = { period: string; page: number; pageSize: number; total: number; items: CatalogItem[] };

type History = {
  oldValueText: string; newValueText: string; oldVersion: number; newVersion: number;
  reason: string; updatedBy: string; updatedAt: string;
};

export function MetricManager({ initialPeriod }: { initialPeriod: string }) {
  const [period, setPeriod] = useState(initialPeriod);
  const [periodAvailable, setPeriodAvailable] = useState<boolean | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<(CatalogResult & { key: string }) | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [monthPickerKey, setMonthPickerKey] = useState(0);
  const [message, setMessage] = useState("");
  const queryKey = JSON.stringify([period, search, page]);
  const current = result?.key === queryKey ? result : null;

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setRetry((previous) => previous + 1);
    }, 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (searchInput.trim() === search) return;
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
      setExpandedId(null);
      setMessage("");
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, search]);

  useEffect(() => {
    if (periodAvailable !== true) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const params = new URLSearchParams({ period, page: String(page), search });
        const response = await fetch(`/api/metrics/catalog?${params}`, { signal: controller.signal, cache: "no-store" });
        const payload = await response.json() as CatalogResult & { error?: { message: string } };
        if (!response.ok) throw new Error(payload.error?.message ?? "加载指标失败");
        if (controller.signal.aborted) return;
        setResult({ ...payload, key: queryKey });
      } catch (error) {
        if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "指标服务暂时不可用");
      }
    })();
    return () => controller.abort();
  }, [period, periodAvailable, search, page, queryKey, retry]);

  function replace(updated: Metric) {
    setResult((previous) => previous ? { ...previous, items: previous.items.map((item) => item.definitionId === updated.definitionId ? { ...item, metric: updated } : item) } : previous);
  }

  function refreshManualMetric(updated: Metric) {
    setPeriod(updated.period);
    setPage(1);
    setSearchInput("");
    setSearch("");
    setExpandedId(null);
    setResult(null);
    setPeriodAvailable(null);
    setMonthPickerKey((previous) => previous + 1);
  }

  return <div className="space-y-6">
    <ManualMetricForm initialPeriod={period} onCreated={refreshManualMetric} />
    <div className="flex flex-wrap items-end gap-3">
      <AvailableMonthPicker key={monthPickerKey} label="指标月份" onAvailabilityChange={setPeriodAvailable} onChange={(next) => { setPeriodAvailable(null); setMessage(""); setPeriod(next); setPage(1); setResult(null); setExpandedId(null); }} periodsUrl="/api/metrics/periods" refreshKey={retry} value={period} />
      <label className="grid min-w-56 gap-2 text-sm">搜索指标<input aria-label="搜索指标" className="h-10 rounded-md border bg-background px-3" maxLength={100} onChange={(event) => setSearchInput(event.target.value)} placeholder="名称、编码或数据源" type="search" value={searchInput} /></label>
      <span className="text-sm">{current ? `共 ${current.total} 个指标` : periodAvailable === null ? "正在确认可用月份…" : periodAvailable === false ? "该月份暂无可用指标" : message ? "指标加载失败" : "正在加载指标…"}</span>
      {message ? <Button onClick={() => { setMessage(""); setRetry((previous) => previous + 1); }} type="button" variant="outline">重试</Button> : null}
    </div>
    {message ? <p className="text-sm" role="status">{message}</p> : null}
    {current ? <>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-200 text-left text-sm">
          <thead className="border-b bg-background"><tr><th className="px-4 py-3" scope="col">指标名称 / 编码</th><th className="px-4 py-3" scope="col">数据源</th><th className="px-4 py-3" scope="col">当前值</th><th className="px-4 py-3" scope="col">版本</th><th className="px-4 py-3" scope="col">最后更新</th><th className="px-4 py-3" scope="col">操作</th></tr></thead>
          <tbody>{current.items.map((item) => <Fragment key={item.definitionId}>
            <tr className="border-b last:border-b-0"><td className="px-4 py-3"><strong>{item.name}</strong><span className="mt-1 block text-xs muted">{item.code}</span></td><td className="px-4 py-3">{item.dataSource.name}</td><td className="px-4 py-3">{item.metric ? <span className="block max-w-64 truncate" title={item.metric.valueText}>{item.metric.valueText}{item.metric.unit ? ` ${item.metric.unit}` : ""}</span> : "该月无值"}</td><td className="px-4 py-3">{item.metric ? `v${item.metric.version}` : "—"}</td><td className="px-4 py-3">{item.metric ? `${item.metric.updatedBy} · ${new Date(item.metric.updatedAt).toLocaleString("zh-CN")}` : "—"}</td><td className="px-4 py-3">{item.metric || item.manual ? <Button aria-expanded={expandedId === item.definitionId} onClick={() => setExpandedId((previous) => previous === item.definitionId ? null : item.definitionId)} size="sm" type="button" variant="outline">{expandedId === item.definitionId ? "收起" : item.metric ? item.writable ? "查看与修改" : "查看详情" : "录入本月值"}</Button> : null}</td></tr>
            {expandedId === item.definitionId && (item.metric || item.manual) ? <tr className="border-b bg-background"><td className="p-4" colSpan={6}><MetricRow item={item.metric ?? { definitionId: item.definitionId, code: item.code, name: item.name, dataSource: item.dataSource, valueText: "", valueType: item.valueType, unit: item.unit, period, version: 0, updatedAt: "", updatedBy: "" }} manual={item.manual} onUpdated={item.metric ? replace : refreshManualMetric} writable={item.writable} /></td></tr> : null}
          </Fragment>)}</tbody>
        </table>
        {current.items.length === 0 ? <p className="p-6 text-center text-sm muted">没有找到符合条件的指标。</p> : null}
      </div>
      <div className="flex items-center justify-between gap-3 text-sm"><span>第 {current.page} / {Math.max(1, Math.ceil(current.total / current.pageSize))} 页</span><div className="flex gap-2"><Button disabled={page <= 1} onClick={() => { setPage((previous) => previous - 1); setExpandedId(null); }} size="sm" type="button" variant="outline">上一页</Button><Button disabled={page * current.pageSize >= current.total} onClick={() => { setPage((previous) => previous + 1); setExpandedId(null); }} size="sm" type="button" variant="outline">下一页</Button></div></div>
    </> : null}
  </div>;
}

function ManualMetricForm({ initialPeriod, onCreated }: { initialPeriod: string; onCreated: (metric: Metric) => void }) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState(initialPeriod);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [valueType, setValueType] = useState<"STRING" | "NUMBER">("NUMBER");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/metrics/manual", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, code, name, valueType, value, unit })
      });
      const payload = await response.json() as { metric?: Metric; error?: { message: string } };
      if (!response.ok || !payload.metric) throw new Error(payload.error?.message ?? "录入失败");
      onCreated(payload.metric);
      setOpen(false);
      setCode(""); setName(""); setValue(""); setUnit("");
      setMessage("指标已录入");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "录入失败");
    } finally {
      setPending(false);
    }
  }

  return <section className="rounded-xl border bg-card p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">手动录入指标</h2><p className="mt-1 text-sm muted">创建指标并填写指定月份的值；沿用已有编码和相同信息可录入新月份。</p></div><Button aria-expanded={open} onClick={() => { if (!open) setPeriod(initialPeriod); setOpen((previous) => !previous); setMessage(""); }} type="button" variant="outline">{open ? "收起录入" : "新增指标"}</Button></div>
    {open ? <form className="mt-5 space-y-4" onSubmit={create}>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="grid gap-2 text-sm">指标名称<input className="h-10 rounded-md border bg-background px-3" disabled={pending} maxLength={191} onChange={(event) => setName(event.target.value)} required value={name} /></label>
        <label className="grid gap-2 text-sm">指标编码<input className="h-10 rounded-md border bg-background px-3" disabled={pending} maxLength={191} onChange={(event) => setCode(event.target.value)} pattern="[A-Za-z0-9_-]+" required value={code} /></label>
        <label className="grid gap-2 text-sm">指标月份<input className="h-10 rounded-md border bg-background px-3" disabled={pending} onChange={(event) => setPeriod(event.target.value)} required type="month" value={period} /></label>
        <label className="grid gap-2 text-sm">值类型<Select aria-label="值类型" disabled={pending} onValueChange={(next) => setValueType(next as "STRING" | "NUMBER")} options={[{ value: "NUMBER", label: "数值" }, { value: "STRING", label: "文本" }]} value={valueType} /></label>
        <label className="grid gap-2 text-sm">指标值<input className="h-10 rounded-md border bg-background px-3" disabled={pending} maxLength={2000} onChange={(event) => setValue(event.target.value)} required value={value} /></label>
        <label className="grid gap-2 text-sm">单位（可选）<input className="h-10 rounded-md border bg-background px-3" disabled={pending} maxLength={64} onChange={(event) => setUnit(event.target.value)} value={unit} /></label>
      </div>
      <Button disabled={pending} type="submit">{pending ? "正在保存…" : "保存指标"}</Button>
    </form> : null}
    {message ? <p className="mt-3 text-sm" role="status">{message}</p> : null}
  </section>;
}

function MetricRow({ item, onUpdated, writable, manual }: { item: Metric; onUpdated: (metric: Metric) => void; writable: boolean; manual: boolean }) {
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
      setMessage(item.version ? "指标已更新并记录修改原因" : "本月指标值已录入");
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
    <p className="mt-1 text-sm">{item.dataSource.name} · {item.period} · {item.version ? `v${item.version} · 当前值 ${item.valueText}${item.unit ? ` ${item.unit}` : ""}` : "该月尚未录入"}</p>
    {item.version ? <p className="mt-1 text-sm">最后更新：{item.updatedBy} · {new Date(item.updatedAt).toLocaleString("zh-CN")}</p> : null}
    {writable ? <div className="mt-4 grid gap-3 md:grid-cols-2">
      <label className="grid gap-2 text-sm">{item.version ? "新值" : "本月指标值"}<input className="h-10 rounded-md border bg-background px-3" disabled={pending} maxLength={2000} onChange={(event) => setValue(event.target.value)} value={value} /></label>
      <label className="grid gap-2 text-sm">修改原因<input className="h-10 rounded-md border bg-background px-3" disabled={pending} maxLength={1000} onChange={(event) => setReason(event.target.value)} value={reason} /></label>
    </div> : null}
    <div className="mt-4 flex flex-wrap items-center gap-3">
      {writable ? <Button disabled={pending || !value.trim() || reason.trim().length < 3} onClick={update} type="button" variant="outline">{item.version ? "保存修改" : "录入本月值"}</Button> : null}
      <Button disabled={pending} onClick={loadHistory} type="button" variant="outline">查看历史</Button>
      {!manual ? <Button disabled={pending} onClick={reconcile} type="button" variant="outline">同步平台记录</Button> : null}
      {message ? <span className="text-sm" role="status">{message}</span> : null}
    </div>
    {history ? <ul className="mt-4 space-y-2 text-sm">{history.length ? history.map((entry) => <li className="rounded-md border p-3" key={`${entry.newVersion}:${entry.updatedAt}`}>
      v{entry.oldVersion} {entry.oldValueText} → v{entry.newVersion} {entry.newValueText} · {entry.reason} · {entry.updatedBy} · {new Date(entry.updatedAt).toLocaleString("zh-CN")}
    </li>) : <li>暂无修改历史</li>}</ul> : null}
  </article>;
}
