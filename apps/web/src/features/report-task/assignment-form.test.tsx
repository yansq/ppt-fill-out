// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssignmentForm } from "./assignment-form";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const fillers = [
  { id: "alice", username: "alice", name: "张三", status: "ACTIVE" },
  { id: "bob", username: "bob", name: "李四", status: "ACTIVE" }
];
const slides = [
  { id: "cover", slideIndex: 0, previewUrl: "/api/templates/t/slides/0/preview", placeholderCount: 0, assignments: [] },
  { id: "content", slideIndex: 1, previewUrl: "/api/templates/t/slides/1/preview", placeholderCount: 2, assignments: [] }
];

afterEach(() => { vi.unstubAllGlobals(); });

describe("page assignment", () => {
  it("shows slide previews, searches people and never assigns an empty slide", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    render(<AssignmentForm fillers={fillers} slides={slides} taskId="task" version={3} />);

    expect(screen.getByRole("link", { name: "查看第 1 页大图" }).getAttribute("href")).toBe(slides[0].previewUrl);
    expect(screen.getByText("无需分配")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "选择第 1 页填报人" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "选择第 2 页填报人" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "搜索第 2 页填报人" }), { target: { value: "李四" } });
    const results = screen.getByRole("group", { name: "第 2 页可选填报人" });
    expect(within(results).getByText("李四（bob）")).toBeTruthy();
    expect(within(results).queryByText("张三（alice）")).toBeNull();
    fireEvent.click(within(results).getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "保存页面分配" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      expectedVersion: 3,
      assignments: [{ slideId: "content", assigneeId: "bob" }]
    });
  });
});
