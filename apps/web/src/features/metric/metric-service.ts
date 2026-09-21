import { createHash, randomUUID } from "node:crypto";

import { prisma } from "@report-platform/database";

import { requireCollector } from "@/features/auth/authorization";
import { decryptPassword } from "@/features/data-source/credential";
import { MetricAdapterError, MySqlMetricDataSource, type MetricRecord } from "@/features/data-source/mysql-adapter";
import { getFillInstance } from "@/features/report-task/report-task-service";

import { demoQueryConfigSchema, periodSchema, updateMetricSchema } from "./metric-policy";

export class MetricServiceError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message);
    this.name = "MetricServiceError";
  }
}

function adapterFor(source: {
  type: string; status: string; host: string | null; port: number | null;
  databaseName: string | null; username: string | null;
  encryptedPassword: string | null; encryptionKeyVersion: string | null;
}) {
  if (source.type !== "MYSQL" || source.status !== "ACTIVE" || !source.host || !source.port || !source.databaseName || !source.username || !source.encryptedPassword || !source.encryptionKeyVersion) {
    throw new MetricServiceError("DATA_SOURCE_INVALID", "指标数据源不可用", 503);
  }
  try {
    return new MySqlMetricDataSource({
      host: source.host,
      port: source.port,
      databaseName: source.databaseName,
      username: source.username,
      password: decryptPassword(source.encryptedPassword, source.encryptionKeyVersion)
    });
  } catch {
    throw new MetricServiceError("ENCRYPTION_UNAVAILABLE", "指标数据源密钥不可用", 503);
  }
}

function publicMetric(record: MetricRecord, definition: { id: string; name: string; code: string; dataSource: { id: string; name: string } }) {
  return {
    definitionId: definition.id,
    code: definition.code,
    name: definition.name,
    dataSource: definition.dataSource,
    valueText: record.valueText,
    valueType: record.valueType,
    unit: record.unit,
    period: record.period,
    updatedAt: record.updatedAt,
    updatedBy: record.updatedBy,
    version: record.version
  };
}

async function queryAllMetrics(period: string) {
  const definitions = await prisma.metricDefinition.findMany({
    where: { dataSource: { status: "ACTIVE" } },
    include: { dataSource: true },
    orderBy: [{ dataSource: { name: "asc" } }, { name: "asc" }]
  });
  const result = [];
  for (const definition of definitions) {
    const mapping = demoQueryConfigSchema.safeParse(definition.queryConfigJson);
    if (!mapping.success) continue;
    try {
      const records = await adapterFor(definition.dataSource).queryMetrics({
        period, sourceCode: mapping.data.sourceCode, metricCodes: [definition.code]
      });
      for (const record of records) result.push(publicMetric(record, definition));
    } catch (error) {
      if (error instanceof MetricServiceError) throw error;
      throw new MetricServiceError("DATASOURCE_UNAVAILABLE", "指标数据源暂时不可用", 503);
    }
  }
  return result;
}

export async function queryMetricForInstance(instanceId: string, periodInput: unknown) {
  const instance = await getFillInstance(instanceId);
  const period = periodSchema.parse(periodInput);
  return {
    reportPeriod: instance.task.reportPeriod,
    viewPeriod: period,
    historical: period !== instance.task.reportPeriod,
    items: await queryAllMetrics(period)
  };
}

export async function queryMetricsForCollector(periodInput: unknown) {
  await requireCollector();
  const period = periodSchema.parse(periodInput);
  return { period, items: await queryAllMetrics(period) };
}

export async function readMetricSnapshot(definitionId: string, period: string) {
  const definition = await prisma.metricDefinition.findUnique({ where: { id: definitionId }, include: { dataSource: true } });
  if (!definition) throw new MetricServiceError("NOT_FOUND", "指标不存在", 404);
  const mapping = demoQueryConfigSchema.safeParse(definition.queryConfigJson);
  if (!mapping.success) throw new MetricServiceError("UNSUPPORTED_MAPPING", "指标映射暂不支持", 409);
  let record;
  try {
    const records = await adapterFor(definition.dataSource).queryMetrics({ period, sourceCode: mapping.data.sourceCode, metricCodes: [definition.code] });
    record = records[0];
  } catch (error) {
    if (error instanceof MetricServiceError) throw error;
    throw new MetricServiceError("DATASOURCE_UNAVAILABLE", "指标数据源暂时不可用", 503);
  }
  if (!record) throw new MetricServiceError("NOT_FOUND", "该月份暂无指标值", 404);
  return {
    definitionId: definition.id,
    dataSourceId: definition.dataSourceId,
    dataSourceName: definition.dataSource.name,
    ...record
  };
}

export async function updateMetricValue(definitionId: string, input: unknown) {
  const actor = await requireCollector();
  const parsed = updateMetricSchema.parse(input);
  const definition = await prisma.metricDefinition.findUnique({ where: { id: definitionId }, include: { dataSource: true } });
  if (!definition) throw new MetricServiceError("NOT_FOUND", "指标不存在", 404);
  if (!definition.writable) throw new MetricServiceError("FORBIDDEN", "该指标不可修改", 403);
  const mapping = demoQueryConfigSchema.safeParse(definition.updateConfigJson);
  if (!mapping.success) throw new MetricServiceError("UNSUPPORTED_MAPPING", "指标不支持在线修改", 409);
  if (definition.valueType === "NUMBER" && !/^-?\d+(\.\d+)?$/.test(parsed.value)) {
    throw new MetricServiceError("VALIDATION_ERROR", "数值指标必须填写数字", 400);
  }
  let change;
  try {
    change = await adapterFor(definition.dataSource).updateMetric({
      period: parsed.period,
      sourceCode: mapping.data.sourceCode,
      metricCode: definition.code,
      value: parsed.value,
      expectedVersion: parsed.expectedVersion,
      reason: parsed.reason,
      actor: actor.username
    });
  } catch (error) {
    if (error instanceof MetricServiceError) throw error;
    if (error instanceof MetricAdapterError) {
      throw error.code === "NOT_FOUND"
        ? new MetricServiceError("NOT_FOUND", "该月份暂无指标值", 404)
        : new MetricServiceError("VERSION_CONFLICT", "指标已被其他用户更新，请刷新后重试", 409);
    }
    throw new MetricServiceError("DATASOURCE_UNAVAILABLE", "指标数据源修改失败", 503);
  }
  const dimensionsHash = createHash("sha256").update("{}").digest("hex");
  try {
    await prisma.$transaction(async (tx) => {
      const cached = await tx.metricValue.upsert({
        where: { metricDefinitionId_period_dimensionsHash: { metricDefinitionId: definition.id, period: parsed.period, dimensionsHash } },
        create: {
          metricDefinitionId: definition.id,
          period: parsed.period,
          dimensionsHash,
          dimensionsJson: {},
          valueText: change.valueText,
          valueNumber: definition.valueType === "NUMBER" ? change.valueText : null,
          sourceVersion: String(change.version),
          sourceUpdatedAt: new Date(change.updatedAt)
        },
        update: {
          valueText: change.valueText,
          valueNumber: definition.valueType === "NUMBER" ? change.valueText : null,
          sourceVersion: String(change.version),
          sourceUpdatedAt: new Date(change.updatedAt),
          version: { increment: 1 },
          fetchedAt: new Date()
        }
      });
      await tx.metricValueHistory.create({
        data: {
          metricValueId: cached.id,
          oldValueJson: { valueText: change.previousValueText, version: parsed.expectedVersion },
          newValueJson: { valueText: change.valueText, version: change.version },
          reason: parsed.reason,
          operatorId: actor.id,
          expectedVersion: parsed.expectedVersion
        }
      });
      await tx.operationLog.create({
        data: {
          actorId: actor.id,
          action: "METRIC_VALUE_UPDATED",
          resourceType: "MetricDefinition",
          resourceId: definition.id,
          correlationId: randomUUID(),
          metadataJson: { period: parsed.period, sourceVersion: change.version }
        }
      });
    });
  } catch {
    throw new MetricServiceError("SYNC_PENDING", "源库已修改，平台镜像待同步；请勿直接重试修改", 503);
  }
  return publicMetric(change, definition);
}

export async function getMetricHistory(definitionId: string, periodInput: unknown) {
  await requireCollector();
  const period = periodSchema.parse(periodInput);
  const definition = await prisma.metricDefinition.findUnique({ where: { id: definitionId }, include: { dataSource: true } });
  if (!definition) throw new MetricServiceError("NOT_FOUND", "指标不存在", 404);
  const mapping = demoQueryConfigSchema.safeParse(definition.queryConfigJson);
  if (!mapping.success) throw new MetricServiceError("UNSUPPORTED_MAPPING", "指标映射暂不支持", 409);
  try {
    return { period, items: await adapterFor(definition.dataSource).getMetricHistory({
      period, sourceCode: mapping.data.sourceCode, metricCode: definition.code
    }) };
  } catch (error) {
    if (error instanceof MetricServiceError) throw error;
    throw new MetricServiceError("DATASOURCE_UNAVAILABLE", "指标修改历史暂时不可用", 503);
  }
}
