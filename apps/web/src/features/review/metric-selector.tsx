"use client";

import { useEffect, useState } from "react";

import { Button } from "@report-platform/ui/button";

type MetricOption = {
  definitionId: string;
  code: string;
  name: string;
  valueText: string;
  unit: string | null;
  dataSource: { name: string };
};

export function MetricSelector({
  period,
  busy,
  onSave,
}: {
  period: string;
  busy: boolean;
  onSave: (definitionId: string) => void;
}) {
  const [metrics, setMetrics] = useState<MetricOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(
          `/api/metrics?period=${encodeURIComponent(period)}`,
          { signal: controller.signal },
        );
        const result = (await response.json()) as {
          items?: MetricOption[];
          error?: { message: string };
        };
        if (!response.ok)
          throw new Error(result.error?.message ?? "指标加载失败");
        if (!controller.signal.aborted) setMetrics(result.items ?? []);
      } catch (cause) {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : "指标加载失败");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [period, retry]);

  const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
  const matches = normalizedQuery
    ? metrics.filter((metric) =>
        `${metric.name} ${metric.code} ${metric.dataSource.name}`
          .toLocaleLowerCase("zh-CN")
          .includes(normalizedQuery),
      )
    : metrics;
  const visibleMatches = matches.slice(0, 50);
  const selectedMetric = metrics.find(
    (metric) => metric.definitionId === selectedId,
  );

  return (
    <div className="metric-browser">
      <label className="grid gap-2 text-sm font-medium">
        搜索指标
        <input
          aria-label="搜索指标名称、编码或数据源"
          className="h-10 w-full rounded-md border bg-card px-3"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="输入名称、编码或数据源"
          type="search"
          value={query}
        />
      </label>
      {loading ? (
        <p className="metric-browser-state" role="status">
          正在加载 {period} 的指标…
        </p>
      ) : error ? (
        <div className="metric-browser-state" role="alert">
          <p>{error}</p>
          <Button
            className="mt-2"
            onClick={() => {
              setError("");
              setLoading(true);
              setRetry((value) => value + 1);
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            重试
          </Button>
        </div>
      ) : (
        <>
          <p className="metric-browser-count">
            {normalizedQuery
              ? `找到 ${matches.length} 项`
              : `共 ${metrics.length} 项`}
          </p>
          <div
            aria-label="可用指标"
            className="metric-browser-results"
            role="group"
          >
            {visibleMatches.map((metric) => (
              <button
                aria-label={`${metric.name}（${metric.code}）· ${metric.valueText}${metric.unit ?? ""} · ${metric.dataSource.name}`}
                aria-pressed={metric.definitionId === selectedId}
                className="metric-browser-option"
                key={metric.definitionId}
                onClick={() => setSelectedId(metric.definitionId)}
                type="button"
              >
                <span className="metric-browser-option-main">
                  <strong>{metric.name}</strong>
                  <small>
                    {metric.code} · {metric.dataSource.name}
                  </small>
                </span>
                <span className="metric-browser-option-value">
                  {metric.valueText}
                  {metric.unit ?? ""}
                </span>
              </button>
            ))}
            {matches.length === 0 ? (
              <p className="metric-browser-state">
                {metrics.length
                  ? "没有匹配的指标，请换个关键词。"
                  : "该月份暂无可用指标，可切换月份或手工填写。"}
              </p>
            ) : null}
            {matches.length > visibleMatches.length ? (
              <p className="metric-browser-state">
                显示前 {visibleMatches.length} 项，请输入关键词缩小范围。
              </p>
            ) : null}
          </div>
          {selectedMetric ? (
            <div className="metric-browser-footer">
              <p>
                将引用 <strong>{selectedMetric.name}</strong>：
                {selectedMetric.valueText}
                {selectedMetric.unit ?? ""}
              </p>
              <Button
                disabled={busy}
                onClick={() => onSave(selectedMetric.definitionId)}
                size="sm"
                type="button"
              >
                保存指标值
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
