import { beforeEach, describe, expect, it, vi } from "vitest";

const { count, findMany, requireCollector, queryMetrics } = vi.hoisted(() => ({
  count: vi.fn(), findMany: vi.fn(), requireCollector: vi.fn(), queryMetrics: vi.fn()
}));

vi.mock("@report-platform/database", () => ({ prisma: { metricDefinition: { count, findMany } }, Prisma: {} }));
vi.mock("@/features/auth/authorization", () => ({ requireCollector }));
vi.mock("@/features/report-task/report-task-service", () => ({ getFillInstance: vi.fn() }));
vi.mock("@/features/data-source/credential", () => ({ decryptPassword: () => "test-password" }));
vi.mock("@/features/data-source/mysql-adapter", () => ({
  MySqlMetricDataSource: class { queryMetrics = queryMetrics; },
  MetricAdapterError: class extends Error {}
}));

import { listMetricCatalog } from "./metric-service";

const source = {
  id: "source-1", name: "经营数据库", type: "MYSQL", status: "ACTIVE", host: "metrics.internal", port: 3306,
  databaseName: "metrics", username: "reader", encryptedPassword: "encrypted", encryptionKeyVersion: "v1"
};

const definition = (id: string, code: string) => ({
  id, code, name: `指标 ${code}`, dataSourceId: source.id, dataSource: source, writable: true,
  queryConfigJson: { adapter: "demo_metric_record", sourceCode: "demo" }
});

beforeEach(() => { vi.clearAllMocks(); requireCollector.mockResolvedValue({ id: "collector-1" }); });

describe("metric catalog", () => {
  it("pages definitions, searches metadata and batches source values", async () => {
    count.mockResolvedValue(42);
    findMany.mockResolvedValue([definition("id-1", "revenue"), definition("id-2", "profit")]);
    queryMetrics.mockResolvedValue([{
      metricCode: "revenue", valueText: "100", valueType: "NUMBER", unit: "万元",
      period: "2026-09", version: 1, updatedAt: "2026-09-01T00:00:00.000Z", updatedBy: "admin"
    }]);

    const result = await listMetricCatalog({ period: "2026-09", page: "2", search: "  指标  " });

    expect(requireCollector).toHaveBeenCalledOnce();
    expect(count).toHaveBeenCalledWith({ where: expect.objectContaining({ OR: expect.arrayContaining([{ name: { contains: "指标" } }]) }) });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 20 }));
    expect(queryMetrics).toHaveBeenCalledOnce();
    expect(queryMetrics).toHaveBeenCalledWith({ period: "2026-09", sourceCode: "demo", metricCodes: ["revenue", "profit"] });
    expect(result).toMatchObject({ page: 2, pageSize: 20, total: 42, items: [
      { code: "revenue", metric: { valueText: "100" } },
      { code: "profit", metric: null }
    ] });
  });

  it("rejects invalid page inputs before querying data", async () => {
    await expect(listMetricCatalog({ period: "2026-09", page: "0", search: "" })).rejects.toThrow();
    expect(count).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });
});
