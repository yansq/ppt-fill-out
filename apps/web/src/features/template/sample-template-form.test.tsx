// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SampleTemplateForm } from "./sample-template-form";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); refresh.mockClear(); });

describe("sample template form", () => {
  it("reviews generated suggestions before confirming a template", async () => {
    const segment = { slideIndex: 0, shapeId: 1, tableRow: null, tableColumn: null, paragraphIndex: 0, text: "产量 1234 吨" };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ draft: { sha256: "a".repeat(64), segments: [segment], replacements: [{ segment, originalText: "1234", key: "production" }], model: "test-model" } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ template: { name: "月报", slides: [{}] } }) });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<SampleTemplateForm />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput.className).toContain("sr-only");
    expect(fileInput.tabIndex).toBe(-1);
    const openPicker = vi.spyOn(fileInput, "click").mockImplementation(() => {});
    fireEvent.click(screen.getByRole("button", { name: "选择文件" }));
    expect(openPicker).toHaveBeenCalledOnce();
    expect(screen.getByText("选择文件")).toBeTruthy();
    expect(screen.getByText("未选择文件")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("模板名称"), { target: { value: "月报" } });
    fireEvent.change(fileInput, { target: { files: [new File(["pptx"], "sample.pptx")] } });
    expect(screen.getByText("sample.pptx")).toBeTruthy();
    fireEvent.click(screen.getByText("生成占位符候选"));
    await waitFor(() => expect(screen.getByText("确认占位符")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("占位符 key"), { target: { value: "output" } });
    fireEvent.click(screen.getByText("确认并保存模板"));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    const body = fetchMock.mock.calls[1][1].body as FormData;
    expect(JSON.parse(body.get("replacements") as string)[0].key).toBe("output");
    expect(body.get("sha256")).toBe("a".repeat(64));
  });
});
