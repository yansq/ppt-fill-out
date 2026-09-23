import { beforeEach, describe, expect, it, vi } from "vitest";

const { query, execute, end, beginTransaction, commit, rollback, createConnection } = vi.hoisted(() => ({
  query: vi.fn(),
  execute: vi.fn(),
  end: vi.fn(),
  beginTransaction: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  createConnection: vi.fn()
}));

vi.mock("mysql2/promise", () => ({ default: { createConnection } }));

import { MySqlMetricDataSource } from "./mysql-adapter";

beforeEach(() => {
  vi.clearAllMocks();
  createConnection.mockResolvedValue({ query, execute, end, beginTransaction, commit, rollback });
  query.mockResolvedValue([[{ 1: 1 }]]);
  end.mockResolvedValue(undefined);
});

describe("MySQL metric adapter", () => {
  it("uses a bounded connection and closes it after a successful probe", async () => {
    const result = await new MySqlMetricDataSource({
      host: "metrics.internal", port: 3306, databaseName: "metrics", username: "reader", password: "secret"
    }).testConnection();
    expect(result.ok).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(createConnection).toHaveBeenCalledWith(expect.objectContaining({ connectTimeout: 5000, database: "metrics" }));
    expect(query).toHaveBeenCalledWith("SELECT 1");
    expect(end).toHaveBeenCalledOnce();
  });

  it("closes the connection when the probe fails", async () => {
    query.mockRejectedValue(new Error("database detail must stay private"));
    await expect(new MySqlMetricDataSource({
      host: "metrics.internal", port: 3306, databaseName: "metrics", username: "reader", password: "secret"
    }).testConnection()).rejects.toThrow();
    expect(end).toHaveBeenCalledOnce();
  });

  it("uses parameterized period and metric-code filters", async () => {
    execute.mockResolvedValueOnce([[{
      id: 1, data_source_code: "demo", metric_code: "monthly_revenue", metric_name: "月营业收入",
      value_text: "1280.50", value_type: "NUMBER", unit: "万元", period: "2026-09",
      updated_at: new Date("2026-09-01T00:00:00Z"), updated_by: "seed", version: 0
    }]]);
    const adapter = new MySqlMetricDataSource({
      host: "metrics.internal", port: 3306, databaseName: "metrics", username: "reader", password: "secret"
    });
    const rows = await adapter.queryMetrics({ period: "2026-09", sourceCode: "demo", metricCodes: ["monthly_revenue"] });
    expect(rows[0]).toMatchObject({ metricCode: "monthly_revenue", valueText: "1280.50", period: "2026-09" });
    expect(execute).toHaveBeenCalledWith(expect.stringContaining("metric_code IN (?)"), ["demo", "2026-09", "monthly_revenue"]);
    expect(end).toHaveBeenCalledOnce();
  });

  it("lists only months with records for configured metrics", async () => {
    execute.mockResolvedValueOnce([[{ period: "2026-03" }, { period: "2026-09" }]]);
    const adapter = new MySqlMetricDataSource({
      host: "metrics.internal", port: 3306, databaseName: "metrics", username: "reader", password: "secret"
    });
    const periods = await adapter.listAvailablePeriods({ year: "2026", sourceCode: "demo", metricCodes: ["revenue", "profit"] });

    expect(periods).toEqual(["2026-03", "2026-09"]);
    expect(execute).toHaveBeenCalledWith(expect.stringContaining("SELECT DISTINCT period FROM metric_record"), ["demo", "2026-%", "revenue", "profit"]);
    expect(end).toHaveBeenCalledOnce();
  });

  it("rolls back and rejects an outdated source version", async () => {
    execute.mockResolvedValueOnce([[{ id: 1, version: 2 }]]);
    const adapter = new MySqlMetricDataSource({
      host: "metrics.internal", port: 3306, databaseName: "metrics", username: "reader", password: "secret"
    });
    await expect(adapter.updateMetric({
      sourceCode: "demo", metricCode: "monthly_revenue", period: "2026-09",
      value: "99", expectedVersion: 1, reason: "测试修正", actor: "admin"
    })).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    expect(rollback).toHaveBeenCalledOnce();
    expect(commit).not.toHaveBeenCalled();
    expect(end).toHaveBeenCalledOnce();
  });
});
