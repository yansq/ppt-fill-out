// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssignmentForm } from "./assignment-form";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const fillers = [
  { id: "alice", employeeNumber: "100001", username: "alice", name: "张三", status: "ACTIVE" },
  { id: "bob", employeeNumber: "100002", username: "bob", name: "李四", status: "ACTIVE" }
];
const slides = [
  { id: "cover", slideIndex: 0, previewUrl: "/api/templates/t/slides/0/preview", placeholderCount: 0, assignments: [] },
  { id: "content", slideIndex: 1, previewUrl: "/api/templates/t/slides/1/preview", placeholderCount: 2, assignments: [] }
];

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("page assignment", () => {
  it("shows slide previews, searches people and never assigns an empty slide", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    render(<AssignmentForm fillers={fillers} slides={slides} taskId="task" version={3} />);

    expect(screen.getByRole("link", { name: "查看第 1 页大图" }).getAttribute("href")).toBe(slides[0].previewUrl);
    expect(screen.getByText("无需分配")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "选择第 1 页填报人" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "选择第 2 页填报人" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "搜索第 2 页填报人" }), { target: { value: "100002" } });
    const results = screen.getByRole("group", { name: "第 2 页可选填报人" });
    expect(within(results).getByText("李四（100002）")).toBeTruthy();
    expect(within(results).queryByText("张三（100001）")).toBeNull();
    fireEvent.click(within(results).getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "保存页面分配" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      expectedVersion: 3,
      assignments: [{ slideId: "content", assigneeId: "bob" }]
    });
  });

  it("keeps an unregistered employee local until the collector saves assignments", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    render(<AssignmentForm fillers={fillers} slides={slides} taskId="task" version={3} />);

    fireEvent.click(screen.getByRole("button", { name: "选择第 2 页填报人" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "搜索第 2 页填报人" }), { target: { value: "001234" } });
    fireEvent.click(screen.getByRole("button", { name: "按工号添加 001234（未注册）" }));
    expect(screen.getByText("未注册员工（001234）")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "保存页面分配" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      expectedVersion: 3,
      assignments: [{ slideId: "content", employeeNumber: "001234" }]
    });
  });
});
