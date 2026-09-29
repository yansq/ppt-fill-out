// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PageNavigationLayout } from "./page-navigation-layout";

afterEach(cleanup);

describe("resizable page navigation", () => {
  it("adjusts, clamps and resets its width with the keyboard", () => {
    const { container } = render(<PageNavigationLayout label="填报工作区"><nav>报告页面</nav><main>预览</main></PageNavigationLayout>);
    const separator = screen.getByRole("separator", { name: "调整报告页面栏宽度" });
    const layout = container.querySelector(".review-workspace") as HTMLElement;
    layout.getBoundingClientRect = vi.fn(() => ({ left: 0, width: 1000 }) as DOMRect);

    expect(separator.getAttribute("aria-valuenow")).toBe("180");
    fireEvent.keyDown(separator, { key: "ArrowRight" });
    expect(separator.getAttribute("aria-valuenow")).toBe("196");
    expect(layout.style.getPropertyValue("--page-nav-width")).toBe("196px");
    fireEvent.keyDown(separator, { key: "End" });
    expect(separator.getAttribute("aria-valuenow")).toBe("320");
    fireEvent.keyDown(separator, { key: "Home" });
    expect(separator.getAttribute("aria-valuenow")).toBe("128");
    fireEvent.doubleClick(separator);
    expect(separator.getAttribute("aria-valuenow")).toBe("180");
  });

  it("limits dragging so the preview and editor retain room", () => {
    const { container } = render(<PageNavigationLayout label="填报工作区"><nav>报告页面</nav><main>预览</main></PageNavigationLayout>);
    const separator = screen.getByRole("separator", { name: "调整报告页面栏宽度" });
    const layout = container.querySelector(".review-workspace") as HTMLElement;
    layout.getBoundingClientRect = vi.fn(() => ({ left: 50, width: 900 }) as DOMRect);
    let captured = false;
    separator.setPointerCapture = vi.fn(() => { captured = true; });
    separator.hasPointerCapture = vi.fn(() => captured);
    separator.releasePointerCapture = vi.fn(() => { captured = false; });

    fireEvent.pointerDown(separator, { pointerId: 1, clientX: 260 });
    expect(separator.getAttribute("aria-valuenow")).toBe("210");
    fireEvent.pointerMove(separator, { pointerId: 1, clientX: 650 });
    expect(separator.getAttribute("aria-valuenow")).toBe("252");
    expect(separator.getAttribute("aria-valuemax")).toBe("252");
    fireEvent.pointerUp(separator, { pointerId: 1 });
    expect(captured).toBe(false);
  });
});
