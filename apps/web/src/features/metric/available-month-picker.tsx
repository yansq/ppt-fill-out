"use client";

import { useEffect, useId, useRef, useState } from "react";

type AvailableMonthPickerProps = {
  label: string;
  value: string;
  onChange: (period: string) => void;
  onAvailabilityChange?: (available: boolean | null) => void;
  periodsUrl: string;
  disabled?: boolean;
};

const monthNames = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];

function yearOf(period: string) {
  const year = Number(period.slice(0, 4));
  return year >= 1000 && year <= 9999 ? year : new Date().getFullYear();
}

export function AvailableMonthPicker({ label, value, onChange, onAvailabilityChange, periodsUrl, disabled = false }: AvailableMonthPickerProps) {
  const [year, setYear] = useState(() => yearOf(value));
  const [open, setOpen] = useState(false);
  const [periodsByYear, setPeriodsByYear] = useState<Record<number, string[]>>({});
  const [error, setError] = useState<{ year: number; message: string } | null>(null);
  const [retry, setRetry] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogId = useId();

  const fetchYear = open ? year : value ? yearOf(value) : year;
  const periods = periodsByYear[fetchYear];
  useEffect(() => {
    const controller = new AbortController();
    if (periods !== undefined) return;
    void (async () => {
      try {
        const response = await fetch(`${periodsUrl}?year=${fetchYear}`, { signal: controller.signal });
        const result = await response.json() as { periods?: string[]; error?: { message: string } };
        if (!response.ok) throw new Error(result.error?.message ?? "可用月份加载失败");
        if (!controller.signal.aborted) setPeriodsByYear((previous) => ({ ...previous, [fetchYear]: (result.periods ?? []).filter((period) => /^\d{4}-(0[1-9]|1[0-2])$/.test(period) && period.startsWith(`${fetchYear}-`)) }));
      } catch (cause) {
        if (!controller.signal.aborted) setError({ year: fetchYear, message: cause instanceof Error ? cause.message : "可用月份加载失败" });
      }
    })();
    return () => controller.abort();
  }, [periodsUrl, fetchYear, retry, periods]);

  const selectedYear = yearOf(value);
  const selectedPeriods = periodsByYear[selectedYear];
  const available = value && selectedPeriods ? selectedPeriods.includes(value) : value ? null : false;
  useEffect(() => { onAvailabilityChange?.(available); }, [available, onAvailabilityChange]);

  useEffect(() => {
    if (!open) return;
    function closeOnOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
    }
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return <div className="relative min-w-0" ref={rootRef}>
    <span className="mb-2 block text-sm">{label}</span>
    <button aria-controls={dialogId} aria-expanded={open} aria-haspopup="dialog" aria-label={label} className="flex h-10 w-full min-w-40 items-center justify-between gap-3 rounded-md border bg-background px-3 text-left text-sm" disabled={disabled} onClick={() => { if (!open && value) setYear(yearOf(value)); setOpen((previous) => !previous); }} ref={triggerRef} type="button">
      <span>{value ? `${value.slice(0, 4)} 年 ${Number(value.slice(5))} 月${available === false ? "（无指标）" : ""}` : "选择月份"}</span><span aria-hidden="true">▾</span>
    </button>
    {error?.year === fetchYear && !open ? <p className="mt-1 text-xs text-primary" role="alert">可用月份加载失败，请打开后重试。</p> : null}
    {open ? <div aria-label={`${label}选择`} className="absolute left-0 top-full z-30 mt-2 w-72 rounded-xl border bg-card p-4 shadow-xl" id={dialogId} role="dialog">
      <div className="mb-4 flex items-center justify-between gap-3">
        <button aria-label="上一年" className="rounded-md border px-2 py-1 text-sm" disabled={year <= 1000} onClick={() => { setError(null); setYear(year - 1); }} type="button">‹</button>
        <strong>{year} 年</strong>
        <button aria-label="下一年" className="rounded-md border px-2 py-1 text-sm" disabled={year >= 9999} onClick={() => { setError(null); setYear(year + 1); }} type="button">›</button>
      </div>
      {error?.year === year ? <div className="space-y-2 text-sm" role="alert"><p>{error.message}</p><button className="text-primary underline" onClick={() => { setError(null); setRetry((previous) => previous + 1); }} type="button">重试</button></div> : <>
        <div className="grid grid-cols-3 gap-2">{monthNames.map((name, index) => {
          const period = `${year}-${String(index + 1).padStart(2, "0")}`;
          return <button aria-label={`${year}年${index + 1}月`} aria-pressed={value === period} className="rounded-md border px-2 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-35 enabled:hover:bg-accent aria-pressed:bg-accent aria-pressed:text-accent-foreground" disabled={!periods?.includes(period)} key={period} onClick={() => { onChange(period); setOpen(false); triggerRef.current?.focus(); }} type="button">{name}</button>;
        })}</div>
        <p className="mt-3 text-xs muted" role="status">{periods === undefined ? "正在检查可用月份…" : periods.length ? "灰色月份暂无指标，无法选择。" : "该年暂无可用指标月份。"}</p>
      </>}
    </div> : null}
  </div>;
}
