// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MetricSelector } from "./metric-selector";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("metric browser", () => {
  it("loads automatically and filters a large metric list by name, code or source", async () => {
    const metrics = Array.from({ length: 80 }, (_, index) => ({
      definitionId: `metric-${index}`,
      code: `M${index}`,
      name: index === 57 ? "营业收入" : `指标 ${index}`,
      valueText: String(index),
      unit: "元",
      dataSource: { name: index === 57 ? "财务库" : "其他库" },
    }));
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ items: metrics }) });
    const onSave = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<MetricSelector busy={false} onSave={onSave} period="2026-09" />);

    await waitFor(() => expect(screen.getByText("共 80 项")).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/metrics?period=2026-09",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    fireEvent.change(
      screen.getByRole("searchbox", { name: "搜索指标名称、编码或数据源" }),
      { target: { value: "财务库" } },
    );
    expect(screen.getByText("找到 1 项")).toBeTruthy();
    const results = screen.getByRole("group", { name: "可用指标" });
    fireEvent.click(
      within(results).getByRole("button", { name: /营业收入（M57）/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "保存指标值" }));
    expect(onSave).toHaveBeenCalledWith("metric-57");
  });

  it("loads the next period without a separate query action", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = render(
      <MetricSelector busy={false} onSave={vi.fn()} period="2026-09" />,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    rerender(
      <MetricSelector
        busy={false}
        key="2026-10"
        onSave={vi.fn()}
        period="2026-10"
      />,
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/metrics?period=2026-10",
        expect.anything(),
      ),
    );
    expect(screen.queryByRole("button", { name: "查询指标" })).toBeNull();
  });
});
