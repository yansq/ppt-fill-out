// @vitest-environment jsdom

import type { ComponentProps } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReviewPanel } from "./review-panel";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const initial = {
  task: {
    id: "task-1",
    reportPeriod: "2026-09",
    status: "REVIEWING",
    version: 3,
  },
  slides: [
    {
      id: "slide-1",
      slideIndex: 0,
      previewUrl: "/preview/1",
      slideAspectRatio: 16 / 9,
      instances: [],
      placeholders: [
        {
          id: "placeholder-1",
          key: "first",
          occurrenceIndex: 0,
          status: "MISSING",
          submissions: [],
          finalValue: null,
        },
      ],
    },
    {
      id: "slide-2",
      slideIndex: 1,
      previewUrl: "/preview/2",
      slideAspectRatio: 4 / 3,
      instances: [],
      placeholders: [
        {
          id: "placeholder-2",
          key: "second",
          occurrenceIndex: 0,
          status: "MISSING",
          submissions: [],
          finalValue: null,
        },
      ],
    },
  ],
} as unknown as ComponentProps<typeof ReviewPanel>["initial"];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("review page layout", () => {
  it("lets the collector save manual and metric values while the task is filling", async () => {
    const filling = {
      ...initial,
      task: { ...initial.task, status: "FILLING" },
    } as ComponentProps<typeof ReviewPanel>["initial"];
    const savedManual = {
      ...filling,
      task: { ...filling.task, version: 4 },
      slides: filling.slides.map((slide, index) =>
        index === 0
          ? {
              ...slide,
              placeholders: slide.placeholders.map((placeholder) => ({
                ...placeholder,
                finalValue: {
                  valueText: "收集人填写",
                  resolutionType: "MANUAL",
                },
              })),
            }
          : slide,
      ),
    };
    const savedMetric = {
      ...savedManual,
      task: { ...savedManual.task, version: 5 },
      slides: savedManual.slides.map((slide, index) =>
        index === 0
          ? {
              ...slide,
              placeholders: slide.placeholders.map((placeholder) => ({
                ...placeholder,
                finalValue: {
                  valueText: "42",
                  resolutionType: "DATABASE_METRIC",
                  sourceSnapshotJson: { metricName: "收入", period: "2026-09" },
                },
              })),
            }
          : slide,
      ),
    };
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.startsWith("/api/metrics/periods"))
        return { ok: true, json: async () => ({ periods: ["2026-09"] }) };
      if (url.startsWith("/api/metrics?"))
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                definitionId: "metric-1",
                code: "M1",
                name: "收入",
                valueText: "42",
                unit: "元",
                dataSource: { name: "示例库" },
              },
            ],
          }),
        };
      const body = JSON.parse(options?.body as string) as {
        resolutionType: string;
      };
      return {
        ok: true,
        json: async () =>
          body.resolutionType === "MANUAL" ? savedManual : savedMetric,
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ReviewPanel initial={filling} />);

    fireEvent.change(
      screen.getByRole("textbox", { name: "手工最终值 first" }),
      { target: { value: "收集人填写" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "保存人工值" }));
    await waitFor(() =>
      expect(screen.getByText(/最终值：收集人填写/)).toBeTruthy(),
    );
    expect(
      JSON.parse(
        fetchMock.mock.calls.find((call) => call[1]?.method === "PUT")![1]!
          .body as string,
      ),
    ).toMatchObject({
      resolutionType: "MANUAL",
      valueText: "收集人填写",
      expectedVersion: 3,
    });

    fireEvent.click(screen.getByRole("button", { name: "引用指标" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /收入（M1）/ })).toBeTruthy(),
    );
    expect(screen.queryByRole("button", { name: "查询指标" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /收入（M1）/ }));
    fireEvent.click(screen.getByRole("button", { name: "保存指标值" }));
    await waitFor(() => expect(screen.getByText(/最终值：42/)).toBeTruthy());
    expect(screen.getByText(/收入 · 2026-09/)).toBeTruthy();
    const saves = fetchMock.mock.calls.filter(
      (call) => call[1]?.method === "PUT",
    );
    expect(JSON.parse(saves[1][1]!.body as string)).toMatchObject({
      resolutionType: "DATABASE_METRIC",
      metricDefinitionId: "metric-1",
      metricPeriod: "2026-09",
      expectedVersion: 4,
    });
  });

  it("lets the collector edit and save an AI candidate as a manual final value", async () => {
    const saved = {
      ...initial,
      task: { ...initial.task, version: 4 },
      slides: initial.slides.map((slide, index) =>
        index === 0
          ? {
              ...slide,
              placeholders: slide.placeholders.map((placeholder) => ({
                ...placeholder,
                finalValue: {
                  valueText: "修改后的候选",
                  resolutionType: "MANUAL",
                },
              })),
            }
          : slide,
      ),
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidate: { id: "ai-1", outputText: "原始候选" },
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => saved });
    vi.stubGlobal("fetch", fetchMock);
    render(<ReviewPanel initial={initial} />);
    fireEvent.click(screen.getByRole("button", { name: "AI 辅助" }));
    fireEvent.change(screen.getByRole("textbox", { name: "AI 提示词 first" }), {
      target: { value: "突出同比增长" },
    });
    fireEvent.click(screen.getByRole("button", { name: "生成 AI 候选" }));
    await waitFor(() =>
      expect(
        (
          screen.getByRole("textbox", {
            name: "手工最终值 first",
          }) as HTMLInputElement
        ).value,
      ).toBe("原始候选"),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      placeholderId: "placeholder-1",
      prompt: "突出同比增长",
    });
    fireEvent.change(
      screen.getByRole("textbox", { name: "手工最终值 first" }),
      { target: { value: "修改后的候选" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "保存人工值" }));
    await waitFor(() =>
      expect(screen.getByText(/最终值：修改后的候选/)).toBeTruthy(),
    );
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
      resolutionType: "MANUAL",
      valueText: "修改后的候选",
      aiGenerationId: "ai-1",
    });
  });

  it("keeps the same three-column workspace while the task is filling", () => {
    const filling = {
      ...initial,
      task: { ...initial.task, status: "FILLING" },
      slides: initial.slides.map((slide, index) =>
        index === 0
          ? {
              ...slide,
              instances: [
                {
                  id: "instance-1",
                  status: "IN_PROGRESS",
                  assignee: {
                    name: "小王",
                    username: "wang",
                    employeeNumber: "100001",
                  },
                },
              ],
            }
          : slide,
      ),
    } as ComponentProps<typeof ReviewPanel>["initial"];
    render(<ReviewPanel initial={filling} />);

    expect(
      screen.getByRole("group", { name: "填报工作区" }).className,
    ).toContain("review-workspace");
    expect(
      screen.getByRole("navigation", { name: "填报页面导航" }),
    ).toBeTruthy();
    expect(screen.getByRole("img", { name: "第 1 页 PPT 预览" })).toBeTruthy();
    expect(
      screen.getByRole("separator", { name: "调整 PPT 预览宽度" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "第 1 页填报情况" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("navigation", { name: "填报页面导航" }).textContent,
    ).not.toContain("小王");
    fireEvent.click(screen.getByText("填报记录"));
    expect(screen.getByText("小王（100001） · 填写中")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "完成审核" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "查看第 2 页" }));
    expect(
      screen.getByRole("heading", { name: "第 2 页填报情况" }),
    ).toBeTruthy();
  });

  it("uses compact navigation, a resizable PPT preview and current-page controls", () => {
    render(<ReviewPanel initial={initial} />);

    const workspace = screen.getByRole("group", { name: "审核工作区" });
    expect(workspace.className).toContain("review-workspace");
    expect(
      screen.getByRole("navigation", { name: "审核页面导航" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("img", { name: "第 1 页 PPT 预览" }).getAttribute("src"),
    ).toContain("/preview/1");
    expect(screen.getByRole("heading", { name: "第 1 页审核" })).toBeTruthy();
    expect(screen.getAllByText("{{first}}").length).toBeGreaterThan(0);
    expect(screen.queryByText("{{second}}")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "审核第 2 页" }));

    expect(
      screen.getByRole("img", { name: "第 2 页 PPT 预览" }).getAttribute("src"),
    ).toContain("/preview/2");
    expect(screen.getByRole("heading", { name: "第 2 页审核" })).toBeTruthy();
    expect(screen.getAllByText("{{second}}").length).toBeGreaterThan(0);
    expect(screen.queryByText("{{first}}")).toBeNull();
  });

  it("focuses one fill item at a time while keeping other items discoverable", () => {
    const filling = {
      ...initial,
      task: { ...initial.task, status: "FILLING" },
      slides: [
        {
          ...initial.slides[0],
          placeholders: [
            initial.slides[0].placeholders[0],
            {
              id: "placeholder-extra",
              key: "growth",
              occurrenceIndex: 0,
              status: "MISSING",
              submissions: [],
              finalValue: null,
            },
          ],
        },
      ],
    } as ComponentProps<typeof ReviewPanel>["initial"];
    render(<ReviewPanel initial={filling} />);

    expect(
      screen.getByRole("textbox", { name: "手工最终值 first" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("textbox", { name: "手工最终值 growth" }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "查看填报项 growth 第 1 处" }),
    );
    expect(
      screen.getByRole("textbox", { name: "手工最终值 growth" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("textbox", { name: "手工最终值 first" }),
    ).toBeNull();
  });

  it("shows every template page with its fill and review status in one navigation", () => {
    const pages = {
      ...initial,
      slides: [
        {
          id: "empty",
          slideIndex: 0,
          previewUrl: null,
          slideAspectRatio: 16 / 9,
          instances: [],
          placeholders: [],
        },
        {
          id: "waiting",
          slideIndex: 1,
          previewUrl: null,
          slideAspectRatio: 16 / 9,
          instances: [
            {
              id: "instance-1",
              status: "IN_PROGRESS",
              assignee: {
                name: "小王",
                username: "wang",
                employeeNumber: "100001",
              },
            },
          ],
          placeholders: [
            {
              id: "p1",
              key: "value",
              occurrenceIndex: 0,
              status: "MISSING",
              submissions: [],
              finalValue: null,
            },
          ],
        },
        {
          id: "submitted",
          slideIndex: 2,
          previewUrl: null,
          slideAspectRatio: 16 / 9,
          instances: [
            {
              id: "instance-2",
              status: "SUBMITTED",
              assignee: {
                name: "小李",
                username: "li",
                employeeNumber: "100002",
              },
            },
          ],
          placeholders: [
            {
              id: "p2",
              key: "value",
              occurrenceIndex: 0,
              status: "CONSISTENT",
              submissions: [],
              finalValue: null,
            },
          ],
        },
        {
          id: "reviewed",
          slideIndex: 3,
          previewUrl: null,
          slideAspectRatio: 16 / 9,
          instances: [
            {
              id: "instance-3",
              status: "SUBMITTED",
              assignee: {
                name: "小陈",
                username: "chen",
                employeeNumber: "100003",
              },
            },
          ],
          placeholders: [
            {
              id: "p3",
              key: "value",
              occurrenceIndex: 0,
              status: "CONSISTENT",
              submissions: [],
              finalValue: { valueText: "ok", resolutionType: "MANUAL" },
            },
          ],
        },
      ],
    } as unknown as ComponentProps<typeof ReviewPanel>["initial"];
    render(<ReviewPanel initial={pages} />);

    const navigation = screen.getByRole("navigation", { name: "审核页面导航" });
    expect(navigation.textContent).toContain("无需填报");
    expect(navigation.textContent).toContain("填报中");
    expect(navigation.textContent).toContain("待审核");
    expect(navigation.textContent).toContain("审核完成");
    expect(navigation.textContent).not.toContain("小王（100001）");
    expect(screen.getByText("本页没有占位符，无需填报或审核。")).toBeTruthy();
  });

  it("offers the separate generation page only after review succeeds", async () => {
    const ready = {
      ...initial,
      slides: initial.slides.map((slide) => ({
        ...slide,
        placeholders: slide.placeholders.map((placeholder) => ({
          ...placeholder,
          finalValue: { valueText: "已确认", resolutionType: "MANUAL" },
        })),
      })),
    } as ComponentProps<typeof ReviewPanel>["initial"];
    const completed = {
      ...ready,
      task: { ...ready.task, status: "COMPLETED", version: 4 },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => completed }),
    );

    render(<ReviewPanel initial={ready} />);
    expect(screen.queryByRole("button", { name: "生成与导出" })).toBeNull();
    expect(screen.queryByRole("link", { name: "生成与导出" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "完成审核" }));

    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: "生成与导出" }).getAttribute("href"),
      ).toBe("/report-tasks/task-1/generation"),
    );
    expect(screen.getByText("审核已完成")).toBeTruthy();
    expect(screen.getByText("审核已完成，请进入生成与导出页面。")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "完成审核" })).toBeNull();
  });

  it("keeps the generation entry available when a completed task is reopened", () => {
    const completed = {
      ...initial,
      task: { ...initial.task, status: "EXPORTED" },
    } as ComponentProps<typeof ReviewPanel>["initial"];
    render(<ReviewPanel initial={completed} />);

    expect(
      screen.getByRole("link", { name: "生成与导出" }).getAttribute("href"),
    ).toBe("/report-tasks/task-1/generation");
    expect(screen.queryByRole("button", { name: "完成审核" })).toBeNull();
  });
});
