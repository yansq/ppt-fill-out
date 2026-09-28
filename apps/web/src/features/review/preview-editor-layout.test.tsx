// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PreviewEditorLayout } from "./preview-editor-layout";

afterEach(cleanup);

describe("resizable PPT workspace", () => {
  it("lets keyboard users adjust and reset the preview width", () => {
    const { container } = render(
      <PreviewEditorLayout
        editor={<div>编辑区</div>}
        preview={<div>预览区</div>}
      />,
    );
    const separator = screen.getByRole("separator", {
      name: "调整 PPT 预览宽度",
    });
    const layout = container.querySelector(
      ".review-content-layout",
    ) as HTMLElement;

    expect(separator.getAttribute("aria-valuenow")).toBe("64");
    fireEvent.keyDown(separator, { key: "ArrowRight" });
    expect(separator.getAttribute("aria-valuenow")).toBe("69");
    expect(layout.style.getPropertyValue("--preview-share")).toBe("69fr");
    fireEvent.keyDown(separator, { key: "Home" });
    expect(separator.getAttribute("aria-valuenow")).toBe("40");
    fireEvent.doubleClick(separator);
    expect(separator.getAttribute("aria-valuenow")).toBe("64");
  });

  it("resizes the preview by dragging the separator", () => {
    const { container } = render(
      <PreviewEditorLayout
        editor={<div>编辑区</div>}
        preview={<div>预览区</div>}
      />,
    );
    const separator = screen.getByRole("separator", {
      name: "调整 PPT 预览宽度",
    });
    const layout = container.querySelector(
      ".review-content-layout",
    ) as HTMLElement;
    let captured = false;
    layout.getBoundingClientRect = vi.fn(
      () => ({ left: 0, width: 1000 }) as DOMRect,
    );
    separator.setPointerCapture = vi.fn(() => {
      captured = true;
    });
    separator.hasPointerCapture = vi.fn(() => captured);
    separator.releasePointerCapture = vi.fn(() => {
      captured = false;
    });

    fireEvent.pointerDown(separator, { pointerId: 1, clientX: 640 });
    fireEvent.pointerMove(separator, { pointerId: 1, clientX: 700 });
    expect(separator.getAttribute("aria-valuenow")).toBe("68");
    expect(separator.getAttribute("aria-valuemax")).toBe("68");
    fireEvent.pointerUp(separator, { pointerId: 1 });
    expect(captured).toBe(false);
  });
});
