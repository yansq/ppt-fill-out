import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueMock, updateMock, verifyPasswordMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  updateMock: vi.fn(),
  verifyPasswordMock: vi.fn()
}));

vi.mock("@report-platform/database", () => ({
  prisma: {
    user: { findUnique: findUniqueMock },
    userCredential: { update: updateMock }
  }
}));
vi.mock("./password", () => ({ verifyPassword: verifyPasswordMock }));

import { authenticateCredentials } from "./credentials";

describe("credential login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUniqueMock.mockResolvedValue({
      id: "user-1",
      employeeNumber: "123456",
      username: "collector",
      name: "Collector",
      status: "ACTIVE",
      credential: { passwordHash: "stored", failedAttempts: 0, lockedUntil: null }
    });
  });

  it("rejects malformed input before querying users", async () => {
    await expect(authenticateCredentials({ employeeNumber: "12345A", password: "x" })).resolves.toBeNull();
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("returns only profile data after password verification", async () => {
    verifyPasswordMock.mockResolvedValue(true);
    await expect(authenticateCredentials({ employeeNumber: "123456", password: "correct" })).resolves.toEqual({
      id: "user-1",
      name: "Collector"
    });
    expect(findUniqueMock).toHaveBeenCalledWith(expect.objectContaining({ where: { employeeNumber: "123456" } }));
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ data: { failedAttempts: 0, lockedUntil: null } }));
  });

  it("locks the account on the fifth failed password", async () => {
    findUniqueMock.mockResolvedValue({
      id: "user-1",
      status: "ACTIVE",
      credential: { passwordHash: "stored", failedAttempts: 4, lockedUntil: null }
    });
    verifyPasswordMock.mockResolvedValue(false);
    await expect(authenticateCredentials({ employeeNumber: "123456", password: "wrong" })).resolves.toBeNull();
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: { failedAttempts: 0, lockedUntil: expect.any(Date) }
    }));
  });

  it("does not verify a password while an account is locked", async () => {
    findUniqueMock.mockResolvedValue({
      id: "user-1",
      status: "ACTIVE",
      credential: { passwordHash: "stored", failedAttempts: 0, lockedUntil: new Date(Date.now() + 60_000) }
    });
    await expect(authenticateCredentials({ employeeNumber: "123456", password: "correct" })).resolves.toBeNull();
    expect(verifyPasswordMock).not.toHaveBeenCalled();
  });
});
