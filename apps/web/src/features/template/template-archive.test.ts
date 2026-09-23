import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCollector: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  updateMany: vi.fn(),
  createLog: vi.fn()
}));

vi.mock("@/features/auth/authorization", () => ({
  currentActor: mocks.requireCollector,
  requireCollector: mocks.requireCollector
}));

vi.mock("@report-platform/database", () => ({
  TemplateStatus: { UPLOADING: "UPLOADING", PARSING: "PARSING", READY: "READY", PARSE_FAILED: "PARSE_FAILED", ARCHIVED: "ARCHIVED" },
  Prisma: {},
  prisma: {
    reportTemplate: { findMany: mocks.findMany },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({
      reportTemplate: { findFirst: mocks.findFirst, updateMany: mocks.updateMany },
      operationLog: { create: mocks.createLog }
    })
  }
}));

import { archiveTemplate, listTemplates } from "./template-service";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireCollector.mockResolvedValue({ id: "creator-1", roles: new Set(["COLLECTOR"]) });
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.findMany.mockResolvedValue([]);
});

describe("template deletion", () => {
  it("lists unarchived summaries without loading every slide", async () => {
    await expect(listTemplates()).resolves.toEqual([]);
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: [{ OR: [{ createdById: "creator-1" }, { tasks: { some: { collectorId: "creator-1" } } }] }, { status: { not: "ARCHIVED" } }] },
      select: expect.objectContaining({ _count: { select: { slides: true, tasks: true } } })
    }));
    expect(mocks.findMany.mock.calls[0][0]).not.toHaveProperty("include");
  });

  it("archives an owned template and writes an operation log without deleting its task data", async () => {
    mocks.findFirst.mockResolvedValue({ id: "template-1", name: "月报", version: 1, status: "READY" });

    await expect(archiveTemplate("template-1")).resolves.toEqual({ id: "template-1", status: "ARCHIVED" });
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { id: "template-1", createdById: "creator-1" },
      select: { id: true, name: true, version: true, status: true }
    });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "template-1", createdById: "creator-1", status: "READY" },
      data: { status: "ARCHIVED" }
    });
    expect(mocks.createLog).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "TEMPLATE_ARCHIVED", resourceId: "template-1" }) });
  });

  it("does not expose templates that the collector does not own", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await expect(archiveTemplate("someone-elses-template")).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("blocks deletion while parsing is in progress", async () => {
    mocks.findFirst.mockResolvedValue({ id: "template-1", name: "月报", version: 1, status: "PARSING" });

    await expect(archiveTemplate("template-1")).rejects.toMatchObject({ code: "INVALID_STATE", status: 409 });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});
