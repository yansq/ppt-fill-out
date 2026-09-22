// @vitest-environment jsdom

import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FillPageNavigation } from "./page-navigation";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: ComponentProps<"a">) => <a href={href} {...props}>{children}</a>
}));

const pages = [
  { id: "page-1", slideIndex: 0, previewUrl: "/slides/0/preview", status: "SUBMITTED" },
  { id: "page-4", slideIndex: 3, previewUrl: "/slides/3/preview", status: "NOT_STARTED" }
];

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("fill page navigation", () => {
  it("shows PPT thumbnails and selects the assigned page by slide number", () => {
    const { container, rerender } = render(<FillPageNavigation navigation={{ currentId: "page-1", pages }} />);

    expect(container.querySelectorAll("img")).toHaveLength(2);
    expect(container.querySelectorAll("img")[1].getAttribute("src")).toBe("/slides/3/preview");
    expect(container.querySelector('[aria-current="page"]')?.getAttribute("aria-label")).toBe("当前第 1 页");
    expect(screen.getByRole("link", { name: "切换到第 4 页" }).getAttribute("href")).toBe("/fill-instances/page-4");
    expect(screen.getByRole("button", { name: "上一项" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("link", { name: "下一项" }).getAttribute("href")).toBe("/fill-instances/page-4");

    rerender(<FillPageNavigation navigation={{ currentId: "page-4", pages }} />);

    expect(screen.getByRole("link", { name: "切换到第 1 页" }).getAttribute("href")).toBe("/fill-instances/page-1");
    expect(screen.getByRole("button", { name: "下一项" }).hasAttribute("disabled")).toBe(true);
  });

  it("asks before selecting another thumbnail when edits are unsaved", () => {
    const confirm = vi.fn().mockReturnValue(false);
    vi.stubGlobal("confirm", confirm);
    render(<FillPageNavigation navigation={{ currentId: "page-1", pages }} unsaved />);

    const link = screen.getByRole("link", { name: "切换到第 4 页" });
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    fireEvent(link, event);

    expect(confirm).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });
});
