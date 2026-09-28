import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireCollector, sourceUpsert, definitionFindUnique, definitionCreate, valueCreate, valueFindUnique, valueUpdateMany, historyCreate, historyFindMany, logCreate, transaction } = vi.hoisted(() => ({
  requireCollector: vi.fn(), sourceUpsert: vi.fn(), definitionFindUnique: vi.fn(), definitionCreate: vi.fn(),
  valueCreate: vi.fn(), valueFindUnique: vi.fn(), valueUpdateMany: vi.fn(), historyCreate: vi.fn(), historyFindMany: vi.fn(),
  logCreate: vi.fn(), transaction: vi.fn()
}));

vi.mock("@report-platform/database", () => ({
  prisma: {
    $transaction: transaction,
    metricDefinition: { findUnique: definitionFindUnique },
    metricValue: { findUnique: valueFindUnique },
    metricValueHistory: { findMany: historyFindMany }
  },
  Prisma: { PrismaClientKnownRequestError: class extends Error { code = "P2002"; } }
}));
vi.mock("@/features/auth/authorization", () => ({ requireCollector }));
vi.mock("@/features/report-task/report-task-service", () => ({ getFillInstance: vi.fn() }));
vi.mock("@/features/data-source/credential", () => ({ decryptPassword: vi.fn() }));
vi.mock("@/features/data-source/mysql-adapter", () => ({ MySqlMetricDataSource: class {}, MetricAdapterError: class extends Error {} }));

import { createManualMetric, getMetricHistory, readMetricSnapshot, updateMetricValue } from "./metric-service";

const actor = { id: "collector-1", username: "collector" };
const source = { id: "manual-metrics", name: "手动录入", type: "MANUAL", status: "ACTIVE" };
const definition = { id: "metric-1", dataSourceId: source.id, code: "income", name: "营业收入", valueType: "NUMBER", unit: "万元", writable: true, dataSource: source };
const date = new Date("2026-09-28T00:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  requireCollector.mockResolvedValue(actor);
  sourceUpsert.mockResolvedValue(source);
  definitionFindUnique.mockResolvedValue(null);
  definitionCreate.mockResolvedValue(definition);
  valueCreate.mockResolvedValue({ id: "value-1", metricDefinitionId: definition.id, valueText: "100", version: 1, fetchedAt: date });
  historyCreate.mockResolvedValue({ createdAt: date });
  logCreate.mockResolvedValue({});
  transaction.mockImplementation((callback) => callback({
    dataSource: { upsert: sourceUpsert },
    metricDefinition: { findUnique: definitionFindUnique, create: definitionCreate },
    metricValue: { create: valueCreate, findUnique: valueFindUnique, updateMany: valueUpdateMany, findUniqueOrThrow: valueFindUnique },
    metricValueHistory: { create: historyCreate }, operationLog: { create: logCreate }
  }));
});

describe("manual metric service", () => {
  it("creates a definition and first monthly value with history", async () => {
    const result = await createManualMetric({ period: "2026-09", code: "income", name: "营业收入", value: "100", valueType: "NUMBER", unit: "万元" });
    expect(result).toMatchObject({ definitionId: "metric-1", valueText: "100", version: 1, updatedBy: "collector" });
    expect(valueCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ period: "2026-09", version: 1, valueNumber: "100" }) });
    expect(historyCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ reason: "手动录入", expectedVersion: 0, operatorId: actor.id }) });
  });

  it("reuses an existing definition for a new month and rejects conflicting metadata", async () => {
    definitionFindUnique.mockResolvedValueOnce(definition).mockResolvedValueOnce(definition);
    await createManualMetric({ period: "2026-10", code: "income", name: "营业收入", value: "100", valueType: "NUMBER", unit: "万元" });
    expect(definitionCreate).not.toHaveBeenCalled();
    await expect(createManualMetric({ period: "2026-11", code: "income", name: "其他", value: "100", valueType: "NUMBER", unit: "万元" })).rejects.toMatchObject({ code: "METRIC_EXISTS", status: 409 });
  });

  it("checks number precision before any write", async () => {
    await expect(createManualMetric({ period: "2026-09", code: "income", name: "营业收入", value: "1.1234567890123456789", valueType: "NUMBER" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("adds an absent month's value with expected version zero and audit history", async () => {
    definitionFindUnique.mockResolvedValue(definition);
    valueFindUnique.mockResolvedValue(null);
    const result = await updateMetricValue(definition.id, { period: "2026-10", value: "100", expectedVersion: 0, reason: "月度录入" });
    expect(result).toMatchObject({ period: "2026-10", version: 1, valueText: "100" });
    expect(historyCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ expectedVersion: 0, reason: "月度录入" }) });
  });

  it("reads a manual value for a fill-in snapshot and exposes its history", async () => {
    definitionFindUnique.mockResolvedValue(definition);
    valueFindUnique.mockResolvedValue({ id: "value-1", valueText: "100", version: 1, fetchedAt: date, history: [{ createdAt: date, operator: actor }] });
    historyFindMany.mockResolvedValue([{ oldValueJson: {}, newValueJson: { valueText: "100" }, expectedVersion: 0, reason: "手动录入", operator: actor, createdAt: date }]);
    await expect(readMetricSnapshot(definition.id, "2026-09")).resolves.toMatchObject({ dataSourceName: "手动录入", metricName: "营业收入", valueText: "100", period: "2026-09" });
    await expect(getMetricHistory(definition.id, "2026-09")).resolves.toMatchObject({ items: [{ newValueText: "100", updatedBy: "collector" }] });
  });
});
