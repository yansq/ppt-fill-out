// @vitest-environment jsdom

import { createElement, type ComponentProps } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PptPreviewImage } from "./ppt-preview-image";

vi.mock("next/image", () => ({
  default: ({ unoptimized, ...props }: ComponentProps<"img"> & { unoptimized?: boolean }) => {
    void unoptimized;
    return createElement("img", props);
  }
}));

afterEach(() => cleanup());

describe("PPT preview loading", () => {
  it("shows a rendering indicator until the preview image is loaded", () => {
    render(<PptPreviewImage alt="当前页预览" fallbackSrc="/template.png" src="/draft.png" />);

    expect(screen.getByRole("status").textContent).toContain("正在渲染页面预览");
    fireEvent.load(screen.getByRole("img", { name: "当前页预览", hidden: true }));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows a clear failure message when rendering fails", () => {
    render(<PptPreviewImage alt="当前页预览" src="/draft.png" />);

    fireEvent.error(screen.getByRole("img", { name: "当前页预览", hidden: true }));
    expect(screen.getByRole("alert").textContent).toContain("预览加载失败");
  });
});
