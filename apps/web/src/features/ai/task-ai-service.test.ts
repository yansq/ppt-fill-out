import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCollector: vi.fn(),
  task: vi.fn(),
  placeholder: vi.fn(),
  submissions: vi.fn(),
  createGeneration: vi.fn(),
  createLog: vi.fn(),
  generateText: vi.fn()
}));

vi.mock("@/features/auth/authorization", () => ({ requireCollector: mocks.requireCollector }));
vi.mock("@/features/report-task/report-task-service", () => ({
  ReportTaskError: class extends Error {
    constructor(public code: string, message: string, public status: number) { super(message); }
  }
}));
vi.mock("@report-platform/database", () => ({ prisma: {
  reportTask: { findFirst: mocks.task },
  templatePlaceholder: { findFirst: mocks.placeholder },
  submittedValue: { findMany: mocks.submissions },
  $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({
    aiGeneration: { create: mocks.createGeneration }, operationLog: { create: mocks.createLog }
  })
} }));
vi.mock("@ai-sdk/openai-compatible", () => ({ createOpenAICompatible: () => () => "model" }));
vi.mock("ai", () => ({ generateText: mocks.generateText }));

import { generateTaskCandidate } from "./task-ai-service";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AI_PROVIDER", "openai-compatible");
  vi.stubEnv("AI_BASE_URL", "http://internal-ai.local/v1");
  vi.stubEnv("AI_API_KEY", "test-key");
  vi.stubEnv("AI_MODEL", "test-model");
  mocks.requireCollector.mockResolvedValue({ id: "collector-1" });
  mocks.task.mockResolvedValue({ id: "task-1", name: "月报", reportPeriod: "2026-09", templateId: "template-1", status: "REVIEWING" });
  mocks.placeholder.mockResolvedValue({ id: "placeholder-1", key: "summary", originalText: "本月{{summary}}", slide: { slideIndex: 0 } });
  mocks.submissions.mockResolvedValue([{ valueText: "增长" }]);
  mocks.generateText.mockResolvedValue({ text: "候选正文" });
  mocks.createGeneration.mockResolvedValue({ id: "ai-1", outputText: "候选正文" });
});

afterEach(() => vi.unstubAllEnvs());

describe("task AI candidate", () => {
  it("requires an owned task and a placeholder from its template", async () => {
    mocks.task.mockResolvedValueOnce(null);
    await expect(generateTaskCandidate("other-task", { placeholderId: "placeholder-1", prompt: "生成摘要" })).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
    expect(mocks.generateText).not.toHaveBeenCalled();
    mocks.placeholder.mockResolvedValueOnce(null);
    await expect(generateTaskCandidate("task-1", { placeholderId: "other-placeholder", prompt: "生成摘要" })).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it("persists a candidate with its input snapshot and audit entry", async () => {
    await expect(generateTaskCandidate("task-1", { placeholderId: "placeholder-1", prompt: "生成摘要" })).resolves.toEqual({ id: "ai-1", outputText: "候选正文" });
    expect(mocks.createGeneration).toHaveBeenCalledWith({ data: expect.objectContaining({
      taskId: "task-1", placeholderId: "placeholder-1", model: "test-model",
      inputSnapshotJson: expect.objectContaining({ prompt: "生成摘要", submittedValues: ["增长"] })
    }) });
    expect(mocks.createLog).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "AI_CANDIDATE_GENERATED" }) });
  });
});
