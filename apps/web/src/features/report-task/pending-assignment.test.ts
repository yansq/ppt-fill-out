import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireCollectorMock, transactionMock, taskFindFirstMock, txTaskFindFirstMock, taskUpdateManyMock, userFindManyMock, userCreateMock, roleFindUniqueMock, assignmentCreateMock, logCreateMock } = vi.hoisted(() => ({
  requireCollectorMock: vi.fn(), transactionMock: vi.fn(), taskFindFirstMock: vi.fn(), txTaskFindFirstMock: vi.fn(), taskUpdateManyMock: vi.fn(),
  userFindManyMock: vi.fn(), userCreateMock: vi.fn(), roleFindUniqueMock: vi.fn(), assignmentCreateMock: vi.fn(), logCreateMock: vi.fn()
}));

vi.mock("@report-platform/database", () => ({
  Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" }, PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {} },
  prisma: { $transaction: transactionMock, reportTask: { findFirst: taskFindFirstMock } }
}));
vi.mock("@/features/auth/authorization", () => ({ requireCollector: requireCollectorMock }));

import { replaceTaskAssignments } from "./report-task-service";

const task = {
  id: "task-1", collectorId: "collector-1", templateId: "template-1", name: "月报", reportPeriod: "2026-09",
  status: "DRAFT", version: 0, createdAt: new Date("2026-09-01T00:00:00Z"), assignments: [],
  template: { id: "template-1", name: "模板", version: 1, slides: [{ id: "slide-1", slideIndex: 0, previewFileId: null, _count: { placeholders: 1 } }] }
};

describe("assigning an unregistered employee", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireCollectorMock.mockResolvedValue({ id: "collector-1" });
    txTaskFindFirstMock.mockResolvedValue(task);
    taskFindFirstMock.mockResolvedValue(task);
    taskUpdateManyMock.mockResolvedValue({ count: 1 });
    roleFindUniqueMock.mockResolvedValue({ id: "filler-role" });
    userCreateMock.mockResolvedValue({ id: "pending-user" });
    userFindManyMock.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "pending-user" }]);
    transactionMock.mockImplementation((callback) => callback({
      reportTask: { findFirst: txTaskFindFirstMock, updateMany: taskUpdateManyMock },
      user: { findMany: userFindManyMock, create: userCreateMock },
      role: { findUnique: roleFindUniqueMock },
      slideAssignment: { create: assignmentCreateMock },
      operationLog: { create: logCreateMock }
    }));
  });

  it("creates a nameless FILLER and assigns the new user in one transaction", async () => {
    await replaceTaskAssignments("task-1", { expectedVersion: 0, assignments: [{ slideId: "slide-1", employeeNumber: "001234" }] });
    expect(userCreateMock).toHaveBeenCalledWith({
      data: {
        employeeNumber: "001234", username: expect.stringMatching(/^pending-001234-/), name: null, status: "ACTIVE",
        roles: { create: { roleId: "filler-role" } }
      },
      select: { id: true }
    });
    expect(assignmentCreateMock).toHaveBeenCalledWith({ data: expect.objectContaining({
      assigneeId: "pending-user",
      fillInstance: { create: expect.objectContaining({ assigneeId: "pending-user" }) }
    }) });
  });

  it("reuses a user with the same employee number", async () => {
    userFindManyMock.mockReset().mockResolvedValueOnce([{
      id: "existing-user", employeeNumber: "001234", status: "ACTIVE", roles: [{ role: { code: "FILLER" } }]
    }]).mockResolvedValueOnce([{ id: "existing-user" }]);
    await replaceTaskAssignments("task-1", { expectedVersion: 0, assignments: [{ slideId: "slide-1", employeeNumber: "001234" }] });
    expect(userCreateMock).not.toHaveBeenCalled();
    expect(assignmentCreateMock).toHaveBeenCalledWith({ data: expect.objectContaining({ assigneeId: "existing-user" }) });
  });

  it("does not create a user for an invalid slide", async () => {
    await expect(replaceTaskAssignments("task-1", { expectedVersion: 0, assignments: [{ slideId: "wrong-slide", employeeNumber: "001234" }] })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(userCreateMock).not.toHaveBeenCalled();
    expect(assignmentCreateMock).not.toHaveBeenCalled();
  });
});
