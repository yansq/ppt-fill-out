// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TemplateUploadForm } from "./template-upload-form";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  refresh.mockClear();
});

describe("template upload file picker", () => {
  it("shows a Chinese file picker and uploads the selected file", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ template: { name: "月报", slides: [{}] } }) });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<TemplateUploadForm />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const form = container.querySelector("form")!;
    expect(screen.getByText("未选择文件")).toBeTruthy();
    expect(screen.getByText("选择文件")).toBeTruthy();
    expect(input.accept).toContain(".pptx");

    const file = new File(["pptx"], "月度经营报告.pptx", { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByText("月度经营报告.pptx")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("模板名称"), { target: { value: "月报" } });
    fireEvent.submit(form);

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith("/api/templates", expect.objectContaining({ method: "POST", body: expect.any(FormData) }));
    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect((body.get("file") as File).name).toBe("月度经营报告.pptx");
    expect(screen.getByText("未选择文件")).toBeTruthy();
  });

  it("explains an empty upload in Chinese", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<TemplateUploadForm />);
    fireEvent.submit(container.querySelector("form")!);
    expect(screen.getByText("请选择 PPTX 文件")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
