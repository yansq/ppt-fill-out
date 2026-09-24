import { beforeEach, describe, expect, it, vi } from "vitest";

const { transactionMock, roleFindUniqueMock, userFindUniqueMock, userCreateMock, userUpdateMock, roleUpsertMock, credentialCreateMock, logCreateMock, hashPasswordMock } = vi.hoisted(() => ({
  transactionMock: vi.fn(), roleFindUniqueMock: vi.fn(), userFindUniqueMock: vi.fn(), userCreateMock: vi.fn(), userUpdateMock: vi.fn(),
  roleUpsertMock: vi.fn(), credentialCreateMock: vi.fn(), logCreateMock: vi.fn(), hashPasswordMock: vi.fn()
}));

vi.mock("@report-platform/database", () => ({
  Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" }, PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {} },
  prisma: { $transaction: transactionMock }
}));
vi.mock("./password", () => ({ hashPassword: hashPasswordMock }));

import { registerFiller, registerSchema } from "./register";

const input = { employeeNumber: "001234", name: "张三", password: "pass123", confirmPassword: "pass123" };

describe("employee self-registration", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    hashPasswordMock.mockResolvedValue("salted-hash");
    roleFindUniqueMock.mockResolvedValue({ id: "filler-role" });
    userFindUniqueMock.mockResolvedValue(null);
    userCreateMock.mockResolvedValue({ id: "new-user", employeeNumber: "001234" });
    userUpdateMock.mockResolvedValue({ id: "pending-user", employeeNumber: "001234" });
    transactionMock.mockImplementation((callback) => callback({
      role: { findUnique: roleFindUniqueMock },
      user: { findUnique: userFindUniqueMock, create: userCreateMock, update: userUpdateMock },
      userRole: { upsert: roleUpsertMock },
      userCredential: { create: credentialCreateMock },
      operationLog: { create: logCreateMock }
    }));
  });

  it("rejects invalid employee numbers and short passwords before database access", async () => {
    expect(registerSchema.safeParse({ ...input, employeeNumber: "12345" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...input, password: "short", confirmPassword: "short" }).success).toBe(false);
    await expect(registerFiller({ ...input, employeeNumber: "12345" })).rejects.toBeTruthy();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("creates a new user with only the FILLER role and a salted credential", async () => {
    await expect(registerFiller(input)).resolves.toEqual({ employeeNumber: "001234" });
    expect(userCreateMock).toHaveBeenCalledWith({ data: {
      employeeNumber: "001234", username: "张三-001234", name: "张三", status: "ACTIVE"
    } });
    expect(roleFindUniqueMock).toHaveBeenCalledWith({ where: { code: "FILLER" }, select: { id: true } });
    expect(roleUpsertMock).toHaveBeenCalledWith(expect.objectContaining({ create: { userId: "new-user", roleId: "filler-role" } }));
    expect(credentialCreateMock).toHaveBeenCalledWith({ data: { userId: "new-user", passwordHash: "salted-hash" } });
    expect(JSON.stringify(logCreateMock.mock.calls)).not.toContain(input.password);
  });

  it("claims a pending assignee without changing their user ID", async () => {
    userFindUniqueMock.mockResolvedValue({
      id: "pending-user", employeeNumber: "001234", username: "pending-001234-uuid", name: null,
      status: "ACTIVE", credential: null, roles: [{ role: { code: "FILLER" } }]
    });
    await registerFiller(input);
    expect(userCreateMock).not.toHaveBeenCalled();
    expect(userUpdateMock).toHaveBeenCalledWith({ where: { id: "pending-user" }, data: { name: "张三", username: "张三-001234" } });
    expect(credentialCreateMock).toHaveBeenCalledWith({ data: { userId: "pending-user", passwordHash: "salted-hash" } });
  });

  it("rejects duplicate and disabled accounts without replacing credentials", async () => {
    userFindUniqueMock.mockResolvedValueOnce({ status: "ACTIVE", credential: { userId: "registered" }, roles: [] });
    await expect(registerFiller(input)).rejects.toMatchObject({ code: "ALREADY_REGISTERED", status: 409 });
    userFindUniqueMock.mockResolvedValueOnce({ status: "DISABLED", credential: null, roles: [] });
    await expect(registerFiller(input)).rejects.toMatchObject({ code: "ACCOUNT_DISABLED", status: 409 });
    expect(credentialCreateMock).not.toHaveBeenCalled();
  });

  it("never claims a Collector account through the public registration route", async () => {
    userFindUniqueMock.mockResolvedValue({ status: "ACTIVE", credential: null, roles: [{ role: { code: "COLLECTOR" } }] });
    await expect(registerFiller(input)).rejects.toMatchObject({ code: "ACCOUNT_RESERVED", status: 409 });
    expect(credentialCreateMock).not.toHaveBeenCalled();
  });
});
