// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MetricManager } from "./metric-manager";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("metric manager month loading", () => {
  it("loads the initial month and automatically refreshes after switching months", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => Promise.resolve({
      ok: true,
      json: async () => url.includes("/periods")
        ? { periods: ["2026-08", "2026-09"] }
        : { items: [{
          definitionId: "metric-1", code: "revenue", name: "营业收入", valueText: url.includes("2026-08") ? "80" : "90",
          valueType: "NUMBER", unit: "万元", period: url.includes("2026-08") ? "2026-08" : "2026-09", version: 1,
          updatedAt: "2026-09-01T00:00:00.000Z", updatedBy: "admin", dataSource: { id: "source-1", name: "经营数据库" }
        }] }
    }));
    vi.stubGlobal("fetch", fetchMock);
    render(<MetricManager initialPeriod="2026-09" />);

    await waitFor(() => expect(screen.getByText(/当前值 90 万元/)).toBeTruthy());
    expect(screen.queryByRole("button", { name: "查询指标" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "指标月份" }));
    fireEvent.click(screen.getByRole("button", { name: "2026年8月" }));
    await waitFor(() => expect(screen.getByText(/当前值 80 万元/)).toBeTruthy());
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/metrics?period="))).toHaveLength(2);
  });

  it("offers retry after an automatic load fails", async () => {
    let attempts = 0;
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => Promise.resolve(url.includes("/periods")
      ? { ok: true, json: async () => ({ periods: ["2026-09"] }) }
      : ++attempts === 1
        ? { ok: false, json: async () => ({ error: { message: "指标源暂不可用" } }) }
        : { ok: true, json: async () => ({ items: [] }) })));
    render(<MetricManager initialPeriod="2026-09" />);

    await waitFor(() => expect(screen.getByText("指标源暂不可用")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    await waitFor(() => expect(screen.getByText("0 个指标")).toBeTruthy());
    expect(attempts).toBe(2);
  });
});
