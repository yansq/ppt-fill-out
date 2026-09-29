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
  it("lets the collector start filling without choosing a person", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    render(<AssignmentForm fillers={fillers} slides={slides} taskId="task" version={3} />);
    expect(screen.getByText("未分配填报人时，由收集人填写本页。")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "开始收集人填写" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ expectedVersion: 3, assignments: [] });
  });

  it("shows slide previews, searches people and never assigns an empty slide", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    render(<AssignmentForm fillers={fillers} slides={slides} taskId="task" version={3} />);

    expect(screen.getByRole("button", { name: "查看第 2 页分配" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "查看第 1 页分配" }));
    expect(screen.getByRole("link", { name: "查看第 1 页大图" }).getAttribute("href")).toBe(slides[0].previewUrl);
    expect(screen.getAllByText("无需分配")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "选择第 1 页填报人" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "查看第 2 页分配" }));
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

  it("keeps selections on other pages and saves all page assignments together", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const assignableSlides = [
      slides[1],
      { id: "summary", slideIndex: 2, previewUrl: null, placeholderCount: 1, assignments: [] }
    ];
    render(<AssignmentForm fillers={fillers} slides={assignableSlides} taskId="task" version={3} />);

    fireEvent.click(screen.getByRole("button", { name: "选择第 2 页填报人" }));
    fireEvent.click(within(screen.getByRole("group", { name: "第 2 页可选填报人" })).getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: "查看第 3 页分配" }));
    fireEvent.click(screen.getByRole("button", { name: "选择第 3 页填报人" }));
    fireEvent.click(within(screen.getByRole("group", { name: "第 3 页可选填报人" })).getAllByRole("checkbox")[1]);
    fireEvent.click(screen.getByRole("button", { name: "保存页面分配" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      expectedVersion: 3,
      assignments: [
        { slideId: "content", assigneeId: "alice" },
        { slideId: "summary", assigneeId: "bob" }
      ]
    });
  });
});
