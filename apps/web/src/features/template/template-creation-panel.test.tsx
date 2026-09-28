// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TemplateCreationPanel } from "./template-creation-panel";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

afterEach(cleanup);

describe("template creation panel", () => {
  it("keeps both upload methods discoverable and only expands the chosen form", () => {
    const { container } = render(<TemplateCreationPanel databaseAvailable />);
    const uploadPanel = container.querySelector("#template-upload-panel") as HTMLDivElement;
    const samplePanel = container.querySelector("#template-sample-panel") as HTMLDivElement;
    const uploadButton = screen.getByRole("button", { name: "上传 PPTX 模板" });
    const sampleButton = screen.getByRole("button", { name: "从样例生成" });

    expect(uploadPanel.hidden).toBe(true);
    expect(samplePanel.hidden).toBe(true);

    fireEvent.click(uploadButton);
    expect(uploadPanel.hidden).toBe(false);
    expect(samplePanel.hidden).toBe(true);
    const name = uploadPanel.querySelector('input[name="name"]') as HTMLInputElement;
    fireEvent.change(name, { target: { value: "月度报告" } });

    fireEvent.click(sampleButton);
    expect(uploadPanel.hidden).toBe(true);
    expect(samplePanel.hidden).toBe(false);

    fireEvent.click(uploadButton);
    expect(uploadPanel.hidden).toBe(false);
    expect(samplePanel.hidden).toBe(true);
    expect(name.value).toBe("月度报告");

    fireEvent.click(uploadButton);
    expect(uploadPanel.hidden).toBe(true);
  });

  it("explains when template creation is unavailable", () => {
    render(<TemplateCreationPanel databaseAvailable={false} />);
    expect(screen.queryByRole("button", { name: "上传 PPTX 模板" })).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("模板服务暂时不可用");
  });
});
