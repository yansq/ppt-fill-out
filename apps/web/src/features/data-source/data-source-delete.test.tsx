// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { DeleteDataSourceButton } from "./data-source-form";

afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

describe("data source deletion", () => {
  it("requires confirmation before deleting and refreshes the list", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetchMock);
    render(<DeleteDataSourceButton id="source-1" metricCount={0} name="经营库" />);

    fireEvent.click(screen.getByRole("button", { name: "删除数据源" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/外部数据库中的数据不会改变/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith("/api/data-sources/source-1", { method: "DELETE" });
  });

  it("explains why a source with metrics cannot be deleted", () => {
    render(<DeleteDataSourceButton id="source-1" metricCount={2} name="经营库" />);
    expect((screen.getByRole("button", { name: "删除数据源" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("已关联 2 个指标，无法删除。")).toBeTruthy();
  });

  it("shows a server conflict and keeps the source visible", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: { message: "该数据源已有指标，无法删除" } }) }));
    render(<DeleteDataSourceButton id="source-1" metricCount={0} name="经营库" />);
    fireEvent.click(screen.getByRole("button", { name: "删除数据源" }));
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("该数据源已有指标，无法删除"));
    expect(refresh).not.toHaveBeenCalled();
  });
});
