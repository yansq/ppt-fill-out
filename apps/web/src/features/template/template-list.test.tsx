// @vitest-environment jsdom

import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TemplateList } from "./template-list";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const templates = [{
  id: "template-1", createdById: "collector-1", name: "月报", version: 2, status: "READY",
  originalFilename: "monthly.pptx", slideCount: 2, taskCount: 1, createdAt: "2026-09-23T00:00:00.000Z"
}] as ComponentProps<typeof TemplateList>["templates"];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  refresh.mockClear();
});

describe("template list", () => {
  it("starts as a summary and loads slide previews only after opening a template", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ template: {
      ...templates[0],
      slides: [{ id: "slide-1", slideIndex: 0, previewUrl: "/api/templates/template-1/slides/0/preview", placeholders: [{ id: "placeholder-1", key: "total" }] }]
    } }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<TemplateList actorId="collector-1" canManage templates={templates} />);

    expect(screen.getByText(/2 页/)).toBeTruthy();
    expect(screen.queryByText("第 1 页")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "查看页面" }));

    await waitFor(() => expect(screen.getByText("第 1 页")).toBeTruthy());
    expect(screen.getByRole("img", { name: "月报 第 1 页预览" })).toBeTruthy();
    expect(screen.getByText("{{total}}")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/api/templates/template-1");
  });

  it("asks before deletion and removes the archived template from the list", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ template: { id: "template-1", status: "ARCHIVED" } }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<TemplateList actorId="collector-1" canManage templates={templates} />);

    fireEvent.click(screen.getByRole("button", { name: "删除模板" }));
    expect(screen.getByText(/已有 1 个任务使用此模板/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));

    await waitFor(() => expect(screen.getByText("暂无已上传模板")).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledWith("/api/templates/template-1", { method: "DELETE" });
    expect(refresh).toHaveBeenCalled();
  });

  it("does not offer deletion to someone other than the creator", () => {
    render(<TemplateList actorId="other-user" canManage templates={templates} />);
    expect(screen.queryByRole("button", { name: "删除模板" })).toBeNull();
  });

  it("does not offer deletion after the creator loses the Collector role", () => {
    render(<TemplateList actorId="collector-1" canManage={false} templates={templates} />);
    expect(screen.queryByRole("button", { name: "删除模板" })).toBeNull();
  });
});
