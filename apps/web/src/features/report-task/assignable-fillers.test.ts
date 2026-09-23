import { beforeEach, describe, expect, it, vi } from "vitest";

const { findManyMock, requireCollectorMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  requireCollectorMock: vi.fn(),
}));

vi.mock("@report-platform/database", () => ({
  Prisma: {},
  prisma: { user: { findMany: findManyMock } },
}));
vi.mock("@/features/auth/authorization", () => ({
  requireCollector: requireCollectorMock,
}));

import { listAssignableFillers } from "./report-task-service";

describe("assignable fillers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCollectorMock.mockResolvedValue({ id: "collector-1" });
    findManyMock.mockResolvedValue([]);
  });

  it("includes active Collectors and Fillers while retaining existing assignees", async () => {
    await listAssignableFillers(["former-assignee"]);

    expect(findManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { OR: [
        { status: "ACTIVE", roles: { some: { role: { code: { in: ["FILLER", "COLLECTOR"] } } } } },
        { id: { in: ["former-assignee"] } },
      ] },
    }));
  });
});
