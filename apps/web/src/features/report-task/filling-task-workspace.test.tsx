// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FillingTaskWorkspace } from "./filling-task-workspace";

vi.mock("../review/review-panel", () => ({ ReviewPanel: () => <p>当前页填报内容</p> }));
vi.mock("./assignment-form", () => ({ AssignmentForm: () => <input aria-label="分配草稿" /> }));

afterEach(cleanup);

describe("filling task workspace", () => {
  it("shows one task view at a time and preserves assignment edits while switching", () => {
    const { container } = render(<FillingTaskWorkspace assignment={{ taskId: "task", version: 1, slides: [], fillers: [] }} review={null as never} />);
    const progress = container.querySelector("#task-progress-panel") as HTMLDivElement;
    const assignments = container.querySelector("#task-assignments-panel") as HTMLDivElement;

    expect(progress.hidden).toBe(false);
    expect(assignments.hidden).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "调整页面分配" }));
    expect(progress.hidden).toBe(true);
    expect(assignments.hidden).toBe(false);

    const draft = screen.getByRole("textbox", { name: "分配草稿" }) as HTMLInputElement;
    fireEvent.change(draft, { target: { value: "已选择人员" } });
    fireEvent.click(screen.getByRole("button", { name: "逐页填报" }));
    expect(progress.hidden).toBe(false);
    expect(assignments.hidden).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "调整页面分配" }));
    expect(draft.value).toBe("已选择人员");
  });
});
