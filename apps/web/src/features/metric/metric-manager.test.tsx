// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MetricManager } from "./metric-manager";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("metric manager month loading", () => {
  it("records an empty month's value for an existing manual metric", async () => {
    const metric = {
      definitionId: "manual-1", code: "income", name: "营业收入", valueText: "120",
      valueType: "NUMBER", unit: "万元", period: "2026-09", version: 1,
      updatedAt: "2026-09-28T00:00:00.000Z", updatedBy: "collector", dataSource: { id: "manual-metrics", name: "手动录入" }
    };
    let saved = false;
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes("/periods")) return Promise.resolve({ ok: true, json: async () => ({ periods: ["2026-09"] }) });
      if (url === "/api/metrics/manual-1" && options?.method === "PUT") {
        expect(JSON.parse(String(options.body))).toMatchObject({ period: "2026-09", value: "120", expectedVersion: 0, reason: "本月补录" });
        saved = true;
        return Promise.resolve({ ok: true, json: async () => ({ metric }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ period: "2026-09", page: 1, pageSize: 20, total: 1, items: [{ ...metric, manual: true, writable: true, metric: saved ? metric : null }] }) });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<MetricManager initialPeriod="2026-09" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "录入本月值" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "录入本月值" }));
    fireEvent.change(screen.getByRole("textbox", { name: "本月指标值" }), { target: { value: "120" } });
    fireEvent.change(screen.getByRole("textbox", { name: "修改原因" }), { target: { value: "本月补录" } });
    fireEvent.click(screen.getByRole("button", { name: "录入本月值" }));
    await waitFor(() => expect(screen.getByRole("cell", { name: "120 万元" })).toBeTruthy());
  });

  it("creates a manual metric and reloads its newly available month", async () => {
    let created = false;
    const metric = {
      definitionId: "manual-1", code: "income", name: "营业收入", valueText: "100",
      valueType: "NUMBER", unit: "万元", period: "2026-10", version: 1,
      updatedAt: "2026-09-28T00:00:00.000Z", updatedBy: "collector", dataSource: { id: "manual-metrics", name: "手动录入" }
    };
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url === "/api/metrics/manual" && options?.method === "POST") {
        created = true;
        expect(JSON.parse(String(options.body))).toMatchObject({ code: "income", period: "2026-10", value: "100", valueType: "NUMBER" });
        return Promise.resolve({ ok: true, json: async () => ({ metric }) });
      }
      if (url.includes("/periods")) return Promise.resolve({ ok: true, json: async () => ({ periods: created ? ["2026-09", "2026-10"] : ["2026-09"] }) });
      return Promise.resolve({ ok: true, json: async () => ({ period: created ? "2026-10" : "2026-09", page: 1, pageSize: 20, total: created ? 1 : 0, items: created ? [{ ...metric, manual: true, writable: true, metric }] : [] }) });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<MetricManager initialPeriod="2026-09" />);
    fireEvent.click(screen.getByRole("button", { name: "新增指标" }));
    fireEvent.change(screen.getByRole("textbox", { name: "指标名称" }), { target: { value: "营业收入" } });
    fireEvent.change(screen.getByRole("textbox", { name: "指标编码" }), { target: { value: "income" } });
    fireEvent.change(screen.getByLabelText("指标月份", { selector: "input" }), { target: { value: "2026-10" } });
    fireEvent.change(screen.getByRole("textbox", { name: "指标值" }), { target: { value: "100" } });
    fireEvent.change(screen.getByRole("textbox", { name: "单位（可选）" }), { target: { value: "万元" } });
    fireEvent.click(screen.getByRole("button", { name: "保存指标" }));
    await waitFor(() => expect(screen.getByRole("cell", { name: "100 万元" })).toBeTruthy());
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/periods")).length).toBeGreaterThan(1);
  });

  it("loads the initial month and automatically refreshes after switching months", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/periods")) return Promise.resolve({ ok: true, json: async () => ({ periods: ["2026-08", "2026-09"] }) });
      const params = new URL(url, "http://localhost").searchParams;
      const month = params.get("period") ?? "2026-09";
      const page = Number(params.get("page"));
      const search = params.get("search");
      const name = search ? "利润" : page === 2 ? "第二页指标" : "营业收入";
      const value = month === "2026-08" ? "80" : "90";
      const metric = {
        definitionId: "metric-1", code: "revenue", name, valueText: value,
        valueType: "NUMBER", unit: "万元", period: month, version: 1,
        updatedAt: "2026-09-01T00:00:00.000Z", updatedBy: "admin", dataSource: { id: "source-1", name: "经营数据库" }
      };
      return Promise.resolve({ ok: true, json: async () => ({ period: month, page, pageSize: 20, total: search ? 1 : 45, items: [{ definitionId: metric.definitionId, code: metric.code, name, dataSource: metric.dataSource, writable: true, metric }] }) });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<MetricManager initialPeriod="2026-09" />);

    await waitFor(() => expect(screen.getByRole("cell", { name: "90 万元" })).toBeTruthy());
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "查询指标" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "指标月份" }));
    fireEvent.click(screen.getByRole("button", { name: "2026年8月" }));
    await waitFor(() => expect(screen.getByRole("cell", { name: "80 万元" })).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "下一页" }));
    await waitFor(() => expect(screen.getByText("第二页指标")).toBeTruthy());
    expect(screen.getByText("第 2 / 3 页")).toBeTruthy();

    fireEvent.change(screen.getByRole("searchbox", { name: "搜索指标" }), { target: { value: "利润" } });
    await waitFor(() => expect(screen.getByText("利润")).toBeTruthy());
    expect(screen.getByText("第 1 / 1 页")).toBeTruthy();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/api/metrics/catalog?") && String(url).includes("search=%E5%88%A9%E6%B6%A6"))).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "查看与修改" }));
    expect(screen.getByRole("button", { name: "查看历史" })).toBeTruthy();
  });

  it("offers retry after an automatic load fails", async () => {
    let attempts = 0;
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => Promise.resolve(url.includes("/periods")
      ? { ok: true, json: async () => ({ periods: ["2026-09"] }) }
      : ++attempts === 1
        ? { ok: false, json: async () => ({ error: { message: "指标源暂不可用" } }) }
        : { ok: true, json: async () => ({ period: "2026-09", page: 1, pageSize: 20, total: 0, items: [] }) })));
    render(<MetricManager initialPeriod="2026-09" />);

    await waitFor(() => expect(screen.getByText("指标源暂不可用")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    await waitFor(() => expect(screen.getByText("共 0 个指标")).toBeTruthy());
    expect(attempts).toBe(2);
  });
});
