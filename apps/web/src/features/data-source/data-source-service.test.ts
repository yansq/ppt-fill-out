import { randomBytes } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireCollector, prisma, probe } = vi.hoisted(() => ({
  requireCollector: vi.fn(),
  prisma: {
    $transaction: vi.fn(),
    dataSource: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    operationLog: { create: vi.fn() }
  },
  probe: vi.fn()
}));

vi.mock("@/features/auth/authorization", () => ({ requireCollector }));
vi.mock("@report-platform/database", () => ({
  prisma,
  Prisma: { PrismaClientKnownRequestError: class extends Error {} }
}));
vi.mock("./mysql-adapter", () => ({
  MySqlMetricDataSource: class {
    testConnection = probe;
  }
}));

import { createDataSource, listDataSources, testDataSource } from "./data-source-service";
import { decryptPassword, encryptPassword } from "./credential";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
  process.env.ENCRYPTION_KEY_VERSION = "v1";
  requireCollector.mockResolvedValue({ id: "collector-1" });
  prisma.operationLog.create.mockResolvedValue({});
  prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma));
});

describe("data-source service boundary", () => {
  it("does not query data sources if Collector authorization fails", async () => {
    requireCollector.mockRejectedValue(new Error("FORBIDDEN"));
    await expect(listDataSources()).rejects.toThrow("FORBIDDEN");
    expect(prisma.dataSource.findMany).not.toHaveBeenCalled();
  });

  it("stores only encrypted credentials and returns no password", async () => {
    prisma.dataSource.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      expect(data.password).toBeUndefined();
      expect(data.encryptedPassword).not.toBe("private-password");
      expect(decryptPassword(String(data.encryptedPassword), String(data.encryptionKeyVersion))).toBe("private-password");
      return { id: "source-1", name: data.name, type: "MYSQL" };
    });
    const result = await createDataSource({
      name: "指标库", host: "metrics.internal", databaseName: "metrics", username: "reader", password: "private-password"
    });
    expect(result).not.toHaveProperty("password");
    expect(result).not.toHaveProperty("encryptedPassword");
    expect(prisma.operationLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "DATA_SOURCE_CREATED", afterJson: { name: "指标库", type: "MYSQL" } })
    }));
  });

  it("masks MySQL errors and records a failure without credentials", async () => {
    const secret = encryptPassword("private-password");
    prisma.dataSource.findUnique.mockResolvedValue({
      id: "source-1", type: "MYSQL", host: "metrics.internal", port: 3306,
      databaseName: "metrics", username: "reader", ...secret
    });
    probe.mockRejectedValue(new Error("secret internal driver detail"));
    await expect(testDataSource("source-1")).rejects.toMatchObject({ code: "DATASOURCE_UNAVAILABLE", status: 503 });
    const audit = prisma.operationLog.create.mock.calls[0][0].data;
    expect(audit.action).toBe("DATA_SOURCE_TEST_FAILED");
    expect(JSON.stringify(audit)).not.toContain("private-password");
  });
});
