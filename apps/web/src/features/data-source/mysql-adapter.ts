import mysql, { type ResultSetHeader, type RowDataPacket } from "mysql2/promise";

export interface MySqlConnectionConfig {
  host: string;
  port: number;
  databaseName: string;
  username: string;
  password: string;
}

export interface MetricDataSource {
  testConnection(): Promise<{ ok: boolean; latencyMs: number }>;
  listAvailablePeriods(params: { year: string; sourceCode: string; metricCodes: string[] }): Promise<string[]>;
  queryMetrics(params: { period: string; sourceCode: string; metricCodes?: string[]; search?: string }): Promise<MetricRecord[]>;
  updateMetric(params: { period: string; sourceCode: string; metricCode: string; value: string; expectedVersion: number; reason: string; actor: string }): Promise<MetricRecord & { previousValueText: string }>;
  getMetricHistory(params: { period: string; sourceCode: string; metricCode: string }): Promise<MetricChange[]>;
  getMetricChangesSince(params: { period: string; sourceCode: string; metricCode: string; afterVersion: number; throughVersion: number }): Promise<MetricChange[]>;
}

export interface MetricChange {
  oldValueText: string;
  newValueText: string;
  oldVersion: number;
  newVersion: number;
  reason: string;
  updatedBy: string;
  updatedAt: string;
}

export interface MetricRecord {
  id: string;
  dataSourceCode: string;
  metricCode: string;
  metricName: string;
  valueText: string;
  valueType: "NUMBER" | "STRING";
  unit: string | null;
  period: string;
  updatedAt: string;
  updatedBy: string;
  version: number;
}

interface RecordRow extends RowDataPacket {
  id: number;
  data_source_code: string;
  metric_code: string;
  metric_name: string;
  value_text: string;
  value_type: "NUMBER" | "STRING";
  unit: string | null;
  period: string;
  updated_at: Date;
  updated_by: string;
  version: number;
}

interface ChangeRow extends RowDataPacket {
  old_value_text: string;
  new_value_text: string;
  old_version: number;
  new_version: number;
  reason: string;
  updated_by: string;
  updated_at: Date;
}

function metricRecord(row: RecordRow): MetricRecord {
  return {
    id: String(row.id),
    dataSourceCode: row.data_source_code,
    metricCode: row.metric_code,
    metricName: row.metric_name,
    valueText: row.value_text,
    valueType: row.value_type,
    unit: row.unit,
    period: row.period,
    updatedAt: row.updated_at.toISOString(),
    updatedBy: row.updated_by,
    version: row.version
  };
}

export class MetricAdapterError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "VERSION_CONFLICT") {
    super(code);
  }
}

export class MySqlMetricDataSource implements MetricDataSource {
  constructor(private readonly config: MySqlConnectionConfig) {}

  private connect() {
    return mysql.createConnection({
      host: this.config.host,
      port: this.config.port,
      database: this.config.databaseName,
      user: this.config.username,
      password: this.config.password,
      connectTimeout: 5000,
      enableKeepAlive: false
    });
  }

  async testConnection() {
    const started = performance.now();
    const connection = await this.connect();
    try {
      await connection.query("SELECT 1");
      return { ok: true, latencyMs: Math.round(performance.now() - started) };
    } finally {
      await connection.end();
    }
  }

  async listAvailablePeriods({ year, sourceCode, metricCodes }: Parameters<MetricDataSource["listAvailablePeriods"]>[0]) {
    if (metricCodes.length === 0) return [];
    const connection = await this.connect();
    try {
      const [rows] = await connection.execute<(RowDataPacket & { period: string })[]>(
        `SELECT DISTINCT period FROM metric_record WHERE data_source_code = ? AND period LIKE ? AND metric_code IN (${metricCodes.map(() => "?").join(",")}) ORDER BY period`,
        [sourceCode, `${year}-%`, ...metricCodes]
      );
      return rows.map((row) => row.period);
    } finally {
      await connection.end();
    }
  }

  async queryMetrics({ period, sourceCode, metricCodes, search }: Parameters<MetricDataSource["queryMetrics"]>[0]) {
    const connection = await this.connect();
    try {
      const conditions = ["data_source_code = ?", "period = ?"];
      const values: string[] = [sourceCode, period];
      if (metricCodes?.length) {
        conditions.push(`metric_code IN (${metricCodes.map(() => "?").join(",")})`);
        values.push(...metricCodes);
      }
      if (search) {
        conditions.push("(metric_code LIKE ? OR metric_name LIKE ?)");
        const escaped = search.replace(/[\\%_]/g, "\\$&");
        values.push(`%${escaped}%`, `%${escaped}%`);
      }
      const [rows] = await connection.execute<RecordRow[]>(
        `SELECT id, data_source_code, metric_code, metric_name, value_text, value_type, unit, period, updated_at, updated_by, version FROM metric_record WHERE ${conditions.join(" AND ")} ORDER BY metric_code LIMIT 200`,
        values
      );
      return rows.map(metricRecord);
    } finally {
      await connection.end();
    }
  }

  async updateMetric({ period, sourceCode, metricCode, value, expectedVersion, reason, actor }: Parameters<MetricDataSource["updateMetric"]>[0]) {
    const connection = await this.connect();
    try {
      await connection.beginTransaction();
      const [existing] = await connection.execute<RecordRow[]>(
        "SELECT id, data_source_code, metric_code, metric_name, value_text, value_type, unit, period, updated_at, updated_by, version FROM metric_record WHERE data_source_code = ? AND metric_code = ? AND period = ? FOR UPDATE",
        [sourceCode, metricCode, period]
      );
      const previous = existing[0];
      if (!previous) throw new MetricAdapterError("NOT_FOUND");
      if (previous.version !== expectedVersion) throw new MetricAdapterError("VERSION_CONFLICT");
      const [update] = await connection.execute<ResultSetHeader>(
        "UPDATE metric_record SET value_text = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP(3), version = version + 1 WHERE id = ? AND version = ?",
        [value, actor, previous.id, expectedVersion]
      );
      if (update.affectedRows !== 1) throw new MetricAdapterError("VERSION_CONFLICT");
      await connection.execute(
        "INSERT INTO metric_record_change (record_id, old_value_text, new_value_text, old_version, new_version, reason, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [previous.id, previous.value_text, value, previous.version, previous.version + 1, reason, actor]
      );
      const [updated] = await connection.execute<RecordRow[]>(
        "SELECT id, data_source_code, metric_code, metric_name, value_text, value_type, unit, period, updated_at, updated_by, version FROM metric_record WHERE id = ?",
        [previous.id]
      );
      await connection.commit();
      return { ...metricRecord(updated[0]), previousValueText: previous.value_text };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      await connection.end();
    }
  }

  async getMetricHistory({ period, sourceCode, metricCode }: Parameters<MetricDataSource["getMetricHistory"]>[0]) {
    const connection = await this.connect();
    try {
      const [rows] = await connection.execute<ChangeRow[]>(
        "SELECT c.old_value_text, c.new_value_text, c.old_version, c.new_version, c.reason, c.updated_by, c.updated_at FROM metric_record_change c JOIN metric_record r ON r.id = c.record_id WHERE r.data_source_code = ? AND r.metric_code = ? AND r.period = ? ORDER BY c.id DESC LIMIT 50",
        [sourceCode, metricCode, period]
      );
      return rows.map((row) => ({
        oldValueText: row.old_value_text,
        newValueText: row.new_value_text,
        oldVersion: row.old_version,
        newVersion: row.new_version,
        reason: row.reason,
        updatedBy: row.updated_by,
        updatedAt: row.updated_at.toISOString()
      }));
    } finally {
      await connection.end();
    }
  }

  async getMetricChangesSince({ period, sourceCode, metricCode, afterVersion, throughVersion }: Parameters<MetricDataSource["getMetricChangesSince"]>[0]) {
    const connection = await this.connect();
    try {
      const [rows] = await connection.execute<ChangeRow[]>(
        "SELECT c.old_value_text, c.new_value_text, c.old_version, c.new_version, c.reason, c.updated_by, c.updated_at FROM metric_record_change c JOIN metric_record r ON r.id = c.record_id WHERE r.data_source_code = ? AND r.metric_code = ? AND r.period = ? AND c.new_version > ? AND c.new_version <= ? ORDER BY c.new_version ASC LIMIT 1001",
        [sourceCode, metricCode, period, afterVersion, throughVersion]
      );
      return rows.map((row) => ({
        oldValueText: row.old_value_text,
        newValueText: row.new_value_text,
        oldVersion: row.old_version,
        newVersion: row.new_version,
        reason: row.reason,
        updatedBy: row.updated_by,
        updatedAt: row.updated_at.toISOString()
      }));
    } finally {
      await connection.end();
    }
  }
}
