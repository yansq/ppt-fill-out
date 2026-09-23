// @vitest-environment jsdom

import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FillInEditor } from "./fill-in-editor";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: ComponentProps<"a">) => <a href={href} {...props}>{children}</a>
}));

const initialInstance = {
  id: "instance-1",
  status: "IN_PROGRESS",
  version: 1,
  editable: true,
  previewUrl: "/preview",
  draftPreviewUrl: "/draft-preview?version=1",
  slideAspectRatio: 16 / 9,
  task: { id: "task-1", reportPeriod: "2026-09" },
  placeholders: [{ id: "placeholder-1", key: "summary", occurrenceIndex: 0, originalText: "摘要" }],
  bindings: [{
    placeholderId: "placeholder-1", sourceType: "MANUAL_TEXT", manualValue: "已填写",
    metricDefinitionId: null, metricPeriod: null, sourceSnapshotJson: null
  }]
};

beforeEach(() => {
  window.sessionStorage.clear();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});

describe("placeholder text highlight", () => {
  it("switches the preview to the selected text color and can clear the selection", () => {
    const instance = {
      ...initialInstance,
      placeholders: [
        ...initialInstance.placeholders,
        { id: "placeholder-2", key: "amount", occurrenceIndex: 0, originalText: "金额" }
      ]
    };
    render(<FillInEditor initialInstance={instance} navigation={null} />);

    fireEvent.click(screen.getAllByRole("button", { name: "高亮文字" })[0]);
    expect(screen.getByRole("img", { name: "当前 PPT 页的填报草稿预览" }).getAttribute("src"))
      .toContain("/draft-preview?version=1&highlight=placeholder-1");
    expect(screen.getByRole("button", { name: "取消高亮" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "高亮文字" }));
    expect(screen.getByRole("img", { name: "当前 PPT 页的填报草稿预览" }).getAttribute("src"))
      .toContain("/draft-preview?version=1&highlight=placeholder-2");

    fireEvent.click(screen.getByRole("button", { name: "取消高亮" }));
    expect(screen.getByRole("img", { name: "当前 PPT 页的填报草稿预览" }).getAttribute("src"))
      .toContain("/draft-preview?version=1");
  });
});

describe("metric placement and page switching", () => {
  it("places database metrics directly below the PPT preview", () => {
    render(<FillInEditor initialInstance={initialInstance} navigation={null} />);

    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "PPT 页面预览",
      "引用数据库指标",
      "填写内容"
    ]);
  });

  it("restores loaded metrics when another page of the same task mounts", async () => {
    const metric = {
      definitionId: "metric-1",
      code: "revenue",
      name: "营业收入",
      dataSource: { id: "source-1", name: "经营数据库" },
      valueText: "100",
      unit: "万元",
      period: "2026-09",
      updatedAt: "2026-09-01T00:00:00.000Z",
      updatedBy: "admin",
      version: 1
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [metric] }) });
    vi.stubGlobal("fetch", fetchMock);
    const firstPage = render(<FillInEditor initialInstance={initialInstance} navigation={null} />);

    fireEvent.click(screen.getByRole("button", { name: "加载该月指标" }));
    await waitFor(() => expect(screen.getByText("1 个可用指标")).toBeTruthy());
    firstPage.unmount();

    render(<FillInEditor initialInstance={{ ...initialInstance, id: "instance-2" }} navigation={null} />);
    await waitFor(() => expect(screen.getByText("1 个可用指标")).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("fill completion prompt", () => {
  it("opens after the filler submits the final assigned page", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ instance: { ...initialInstance, status: "SUBMITTED", version: 2 }, allAssignedPagesSubmitted: true })
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<FillInEditor initialInstance={initialInstance} navigation={null} />);

    fireEvent.click(screen.getByRole("button", { name: "提交本页" }));

    await waitFor(() => expect(screen.getByRole("dialog", { name: "已完成填报" })).toBeTruthy());
    expect(screen.getByRole("link", { name: "返回工作台" }).getAttribute("href")).toBe("/");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("does not show completion while another assigned page remains", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ instance: { ...initialInstance, status: "SUBMITTED", version: 2 }, allAssignedPagesSubmitted: false })
    }));
    render(<FillInEditor initialInstance={initialInstance} navigation={null} />);

    fireEvent.click(screen.getByRole("button", { name: "提交本页" }));

    await waitFor(() => expect(screen.getByText("本页已提交，当前不可编辑。")).toBeTruthy());
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
