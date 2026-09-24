import { beforeEach, describe, expect, it, vi } from "vitest";

const { currentActorMock, findUniqueMock, updateManyMock, logCreateMock, verifyPasswordMock, hashPasswordMock, transactionMock } = vi.hoisted(() => ({
  currentActorMock: vi.fn(),
  findUniqueMock: vi.fn(),
  updateManyMock: vi.fn(),
  logCreateMock: vi.fn(),
  verifyPasswordMock: vi.fn(),
  hashPasswordMock: vi.fn(),
  transactionMock: vi.fn()
}));

vi.mock("@report-platform/database", () => ({
  prisma: {
    userCredential: { findUnique: findUniqueMock, updateMany: updateManyMock },
    $transaction: transactionMock
  }
}));
vi.mock("./authorization", () => ({ currentActor: currentActorMock }));
vi.mock("./password", () => ({ verifyPassword: verifyPasswordMock, hashPassword: hashPasswordMock }));

import { changeOwnPassword, changePasswordSchema } from "./change-password";

const input = { currentPassword: "old-password", newPassword: "new-password-123", confirmPassword: "new-password-123" };

describe("self-service password change", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentActorMock.mockResolvedValue({ id: "user-1" });
    findUniqueMock.mockResolvedValue({ userId: "user-1", passwordHash: "stored-hash", failedAttempts: 0, lockedUntil: null });
    updateManyMock.mockResolvedValue({ count: 1 });
    hashPasswordMock.mockResolvedValue("new-hash");
    transactionMock.mockImplementation((callback) => callback({ userCredential: { updateMany: updateManyMock }, operationLog: { create: logCreateMock } }));
  });

  it("requires a matching confirmation and a password of at least 6 characters", () => {
    expect(changePasswordSchema.safeParse({ ...input, confirmPassword: "different" }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ ...input, newPassword: "short", confirmPassword: "short" }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ ...input, newPassword: "six123", confirmPassword: "six123" }).success).toBe(true);
    expect(changePasswordSchema.safeParse({ ...input, newPassword: "            ", confirmPassword: "            " }).success).toBe(false);
  });

  it("changes only the signed-in user's hash and logs no secrets", async () => {
    verifyPasswordMock.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await changeOwnPassword(input);
    expect(findUniqueMock).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { userId: "user-1", passwordHash: "stored-hash" },
      data: { passwordHash: "new-hash", failedAttempts: 0, lockedUntil: null }
    });
    expect(logCreateMock).toHaveBeenCalledWith({ data: expect.objectContaining({ actorId: "user-1", action: "PASSWORD_CHANGED", resourceId: "user-1" }) });
    expect(JSON.stringify(logCreateMock.mock.calls)).not.toContain(input.currentPassword);
    expect(JSON.stringify(logCreateMock.mock.calls)).not.toContain(input.newPassword);
    expect(JSON.stringify(logCreateMock.mock.calls)).not.toContain("new-hash");
  });

  it("rejects the wrong current password and increments the failed-attempt counter", async () => {
    verifyPasswordMock.mockResolvedValue(false);
    await expect(changeOwnPassword(input)).rejects.toMatchObject({ code: "INVALID_CURRENT_PASSWORD", status: 400 });
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { userId: "user-1", passwordHash: "stored-hash", failedAttempts: 0 },
      data: { failedAttempts: 1, lockedUntil: null }
    });
    expect(hashPasswordMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("locks the account after five wrong attempts", async () => {
    findUniqueMock.mockResolvedValue({ userId: "user-1", passwordHash: "stored-hash", failedAttempts: 4, lockedUntil: null });
    verifyPasswordMock.mockResolvedValue(false);
    await expect(changeOwnPassword(input)).rejects.toMatchObject({ code: "INVALID_CURRENT_PASSWORD" });
    expect(updateManyMock).toHaveBeenCalledWith(expect.objectContaining({ data: { failedAttempts: 0, lockedUntil: expect.any(Date) } }));
  });

  it("rejects locked accounts and reused passwords", async () => {
    findUniqueMock.mockResolvedValueOnce({ userId: "user-1", passwordHash: "stored-hash", failedAttempts: 0, lockedUntil: new Date(Date.now() + 60_000) });
    await expect(changeOwnPassword(input)).rejects.toMatchObject({ code: "ACCOUNT_LOCKED", status: 429 });
    verifyPasswordMock.mockResolvedValue(true);
    await expect(changeOwnPassword(input)).rejects.toMatchObject({ code: "PASSWORD_UNCHANGED", status: 400 });
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it("rejects a concurrent credential change without writing an audit event", async () => {
    verifyPasswordMock.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    updateManyMock.mockResolvedValue({ count: 0 });
    await expect(changeOwnPassword(input)).rejects.toMatchObject({ code: "CREDENTIAL_CHANGED", status: 409 });
    expect(logCreateMock).not.toHaveBeenCalled();
  });
});
