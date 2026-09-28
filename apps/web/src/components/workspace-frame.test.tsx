// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkspaceFrame } from "./workspace-frame";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("workspace sidebar", () => {
  it("collapses, reopens, and restores the saved state", async () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    const sidebar = <aside id="workspace-sidebar">导航</aside>;
    const first = render(<WorkspaceFrame sidebar={sidebar}>内容</WorkspaceFrame>);

    fireEvent.click(screen.getByRole("button", { name: "收起侧边栏" }));
    expect(first.container.querySelector(".workspace")?.getAttribute("data-sidebar-collapsed")).toBe("true");
    expect(window.localStorage.getItem("report-platform:sidebar-collapsed")).toBe("true");

    first.unmount();
    const second = render(<WorkspaceFrame sidebar={sidebar}>内容</WorkspaceFrame>);
    await waitFor(() => expect(second.container.querySelector(".workspace")?.getAttribute("data-sidebar-collapsed")).toBe("true"));

    fireEvent.click(screen.getByRole("button", { name: "展开侧边栏" }));
    expect(second.container.querySelector(".workspace")?.getAttribute("data-sidebar-collapsed")).toBe("false");
    expect(window.localStorage.getItem("report-platform:sidebar-collapsed")).toBe("false");
  });
});
