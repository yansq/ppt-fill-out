import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireCollector, transaction, taskFindFirst, taskUpdateMany, instanceCount, placeholderFindMany, finalCount, logCreate, slideFindMany, instanceFindMany, finalFindMany } = vi.hoisted(() => ({
  requireCollector: vi.fn(), transaction: vi.fn(), taskFindFirst: vi.fn(), taskUpdateMany: vi.fn(),
  instanceCount: vi.fn(), placeholderFindMany: vi.fn(), finalCount: vi.fn(), logCreate: vi.fn(),
  slideFindMany: vi.fn(), instanceFindMany: vi.fn(), finalFindMany: vi.fn()
}));

vi.mock("@report-platform/database", () => ({
  Prisma: {},
  prisma: {
    $transaction: transaction,
    reportTask: { findFirst: taskFindFirst },
    templateSlide: { findMany: slideFindMany },
    fillInstance: { findMany: instanceFindMany },
    finalValue: { findMany: finalFindMany }
  }
}));
vi.mock("@/features/auth/authorization", () => ({ requireCollector }));
vi.mock("@/features/report-task/report-task-service", () => ({
  ReportTaskError: class ReportTaskError extends Error {
    constructor(public code: string, message: string, public status: number) { super(message); }
  }
}));
vi.mock("@/features/metric/metric-service", () => ({ readMetricSnapshot: vi.fn() }));

import { completeReview, submitCollectorOnlyTask } from "./review-service";

const task = { id: "task-1", collectorId: "collector-1", templateId: "template-1", reportPeriod: "2026-09", status: "FILLING", version: 2 };

beforeEach(() => {
  vi.clearAllMocks();
  requireCollector.mockResolvedValue({ id: "collector-1" });
  taskFindFirst.mockResolvedValue(task);
  taskUpdateMany.mockResolvedValue({ count: 1 });
  instanceCount.mockResolvedValue(0);
  placeholderFindMany.mockResolvedValue([{ id: "placeholder-1" }]);
  finalCount.mockResolvedValue(1);
  slideFindMany.mockResolvedValue([]);
  instanceFindMany.mockResolvedValue([]);
  finalFindMany.mockResolvedValue([]);
  transaction.mockImplementation((callback) => callback({
    reportTask: { findFirst: taskFindFirst, updateMany: taskUpdateMany },
    fillInstance: { count: instanceCount, findMany: instanceFindMany, updateMany: vi.fn() },
    templatePlaceholder: { findMany: placeholderFindMany },
    finalValue: { count: finalCount },
    operationLog: { create: logCreate }
  }));
});

describe("collector-only filling", () => {
  it("submits a fully filled task into review without a fill instance", async () => {
    await submitCollectorOnlyTask(task.id, { expectedVersion: 2 });
    expect(taskUpdateMany).toHaveBeenCalledWith({
      where: { id: task.id, collectorId: task.collectorId, status: "FILLING", version: 2 },
      data: { status: "REVIEWING", version: { increment: 1 } }
    });
    expect(logCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "COLLECTOR_FILL_SUBMITTED" }) });
  });

  it("requires every placeholder and rejects tasks with assigned fillers", async () => {
    finalCount.mockResolvedValue(0);
    await expect(submitCollectorOnlyTask(task.id, { expectedVersion: 2 })).rejects.toMatchObject({ code: "INVALID_STATE_TRANSITION" });
    instanceCount.mockResolvedValue(1);
    await expect(submitCollectorOnlyTask(task.id, { expectedVersion: 2 })).rejects.toMatchObject({ code: "INVALID_STATE_TRANSITION" });
    expect(taskUpdateMany).not.toHaveBeenCalled();
  });

  it("allows final review of a collector-only task", async () => {
    taskFindFirst.mockResolvedValue({ ...task, status: "REVIEWING" });
    await completeReview(task.id, { expectedVersion: 2 });
    expect(taskUpdateMany).toHaveBeenCalledWith({
      where: { id: task.id, status: "REVIEWING", version: 2 },
      data: { status: "COMPLETED", version: { increment: 1 } }
    });
  });
});
