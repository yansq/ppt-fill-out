import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany, requireCollector, listAvailablePeriods } = vi.hoisted(() => ({
  findMany: vi.fn(), requireCollector: vi.fn(), listAvailablePeriods: vi.fn()
}));

vi.mock("@report-platform/database", () => ({ prisma: { metricDefinition: { findMany } }, Prisma: {} }));
vi.mock("@/features/auth/authorization", () => ({ requireCollector }));
vi.mock("@/features/report-task/report-task-service", () => ({ getFillInstance: vi.fn() }));
vi.mock("@/features/data-source/credential", () => ({ decryptPassword: () => "test-password" }));
vi.mock("@/features/data-source/mysql-adapter", () => ({
  MySqlMetricDataSource: class { listAvailablePeriods = listAvailablePeriods; },
  MetricAdapterError: class extends Error {}
}));

import { availableMetricPeriodsForCollector } from "./metric-service";

const source = {
  id: "source-1", type: "MYSQL", status: "ACTIVE", host: "metrics.internal", port: 3306,
  databaseName: "metrics", username: "reader", encryptedPassword: "encrypted", encryptionKeyVersion: "v1"
};

beforeEach(() => { vi.clearAllMocks(); requireCollector.mockResolvedValue({ id: "collector-1" }); });

describe("available metric periods", () => {
  it("unions source months only for configured metric mappings", async () => {
    findMany.mockResolvedValue([
      { code: "revenue", dataSourceId: source.id, dataSource: source, queryConfigJson: { adapter: "demo_metric_record", sourceCode: "demo" } },
      { code: "profit", dataSourceId: source.id, dataSource: source, queryConfigJson: { adapter: "demo_metric_record", sourceCode: "demo" } },
      { code: "ignored", dataSourceId: source.id, dataSource: source, queryConfigJson: { adapter: "unsupported" } },
      { code: "headcount", dataSourceId: source.id, dataSource: source, queryConfigJson: { adapter: "demo_metric_record", sourceCode: "staff" } }
    ]);
    listAvailablePeriods
      .mockResolvedValueOnce(["2026-09", "2026-03"])
      .mockResolvedValueOnce(["2026-03", "2025-12"]);

    await expect(availableMetricPeriodsForCollector("2026")).resolves.toEqual({ year: "2026", periods: ["2026-03", "2026-09"] });
    expect(requireCollector).toHaveBeenCalledOnce();
    expect(listAvailablePeriods).toHaveBeenCalledTimes(2);
    expect(listAvailablePeriods).toHaveBeenCalledWith({ year: "2026", sourceCode: "demo", metricCodes: ["revenue", "profit"] });
    expect(listAvailablePeriods).toHaveBeenCalledWith({ year: "2026", sourceCode: "staff", metricCodes: ["headcount"] });
  });
});
