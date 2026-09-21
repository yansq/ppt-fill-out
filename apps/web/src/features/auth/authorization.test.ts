import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, findUniqueMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  findUniqueMock: vi.fn()
}));

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@report-platform/database", () => ({
  prisma: { user: { findUnique: findUniqueMock } }
}));

import { currentActor, requireCollector, requireFiller } from "./authorization";

describe("server-side actor authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an unauthenticated request before reading the database", async () => {
    authMock.mockResolvedValue(null);
    await expect(currentActor()).rejects.toMatchObject({ code: "UNAUTHENTICATED", status: 401 });
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("rejects a disabled user even with a valid session", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    findUniqueMock.mockResolvedValue({ id: "user-1", username: "alice", status: "DISABLED", roles: [] });
    await expect(currentActor()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("requires the current database role for Collector actions", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    findUniqueMock.mockResolvedValue({ id: "user-1", username: "alice", status: "ACTIVE", roles: [{ role: { code: "FILLER" } }] });
    await expect(requireCollector()).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("requires the current database role for Filler actions", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    findUniqueMock.mockResolvedValue({ id: "user-1", username: "alice", status: "ACTIVE", roles: [{ role: { code: "COLLECTOR" } }] });
    await expect(requireFiller()).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });
});
