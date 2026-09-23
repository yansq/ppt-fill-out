// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AvailableMonthPicker } from "./available-month-picker";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("available month picker", () => {
  it("greys out months without metrics and only accepts a month with records", async () => {
    const onChange = vi.fn();
    const onAvailabilityChange = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ periods: ["2026-03", "2026-09"] }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<AvailableMonthPicker label="查看月份" onAvailabilityChange={onAvailabilityChange} onChange={onChange} periodsUrl="/api/metrics/periods" value="2026-09" />);

    await waitFor(() => expect(onAvailabilityChange).toHaveBeenCalledWith(true));
    fireEvent.click(screen.getByRole("button", { name: "查看月份" }));
    expect(screen.getByRole("dialog", { name: "查看月份选择" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "2026年10月" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "2026年10月" }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "2026年3月" }));
    expect(onChange).toHaveBeenCalledWith("2026-03");
    expect(fetchMock).toHaveBeenCalledWith("/api/metrics/periods?year=2026", expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });
});
