import { createHash, randomUUID } from "node:crypto";

import { Prisma, prisma } from "@report-platform/database";

import { requireCollector } from "@/features/auth/authorization";
import { decryptPassword } from "@/features/data-source/credential";
import { MetricAdapterError, MySqlMetricDataSource, type MetricRecord } from "@/features/data-source/mysql-adapter";
import { getFillInstance } from "@/features/report-task/report-task-service";

import { demoQueryConfigSchema, metricCatalogQuerySchema, metricYearSchema, periodSchema, updateMetricSchema } from "./metric-policy";
import { hasContinuousHistory } from "./metric-sync-policy";

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

type DefinitionWithSource = Prisma.MetricDefinitionGetPayload<{ include: { dataSource: true } }>;

async function reconcileMirror(definition: DefinitionWithSource, period: string, actorId: string) {
  const mapping = demoQueryConfigSchema.safeParse(definition.queryConfigJson);
  if (!mapping.success) throw new MetricServiceError("UNSUPPORTED_MAPPING", "指标映射暂不支持", 409);
  const adapter = adapterFor(definition.dataSource);
  const records = await adapter.queryMetrics({ period, sourceCode: mapping.data.sourceCode, metricCodes: [definition.code] });
  const record = records[0];
  if (!record) throw new MetricServiceError("NOT_FOUND", "该月份暂无指标值", 404);
  const dimensionsHash = createHash("sha256").update("{}").digest("hex");
  const key = { metricDefinitionId: definition.id, period, dimensionsHash };
  const cached = await prisma.metricValue.findUnique({ where: { metricDefinitionId_period_dimensionsHash: key } });
  const fromVersion = cached?.sourceVersion ? Number(cached.sourceVersion) : 0;
  if (!Number.isInteger(fromVersion) || fromVersion < 0 || fromVersion > record.version) {
    throw new MetricServiceError("SYNC_HISTORY_GAP", "平台指标来源版本无效，无法自动对账", 409);
  }
  const changes = await adapter.getMetricChangesSince({
    period, sourceCode: mapping.data.sourceCode, metricCode: definition.code,
    afterVersion: fromVersion, throughVersion: record.version
  });
  if (changes.length > 1000) throw new MetricServiceError("SYNC_BACKLOG_TOO_LARGE", "指标待同步历史过多，需要分批处理", 503);
  if (!hasContinuousHistory(changes, fromVersion, record.version)) {
    throw new MetricServiceError("SYNC_HISTORY_GAP", "指标源历史版本不连续，无法安全对账", 409);
  }
  if (cached && changes.length === 0 && cached.valueText !== record.valueText) {
    throw new MetricServiceError("SYNC_HISTORY_GAP", "指标源值变化缺少版本历史，无法安全对账", 409);
  }
  if (cached && changes.length === 0 && cached.valueText === record.valueText) {
    return { metric: publicMetric(record, definition), appliedChanges: 0 };
  }

  await prisma.$transaction(async (tx) => {
    const fresh = await tx.metricValue.findUnique({ where: { metricDefinitionId_period_dimensionsHash: key } });
    if (fresh?.version !== cached?.version || fresh?.sourceVersion !== cached?.sourceVersion) {
      throw new MetricServiceError("VERSION_CONFLICT", "指标镜像已被其他请求更新，请重试同步", 409);
    }
    let metricValueId;
    if (fresh) {
      const updated = await tx.metricValue.updateMany({
        where: { id: fresh.id, version: fresh.version, sourceVersion: fresh.sourceVersion },
        data: {
          valueText: record.valueText,
          valueNumber: definition.valueType === "NUMBER" ? record.valueText : null,
          sourceVersion: String(record.version),
          sourceUpdatedAt: new Date(record.updatedAt),
          fetchedAt: new Date(),
          version: { increment: 1 }
        }
      });
      if (updated.count !== 1) throw new MetricServiceError("VERSION_CONFLICT", "指标镜像已被其他请求更新，请重试同步", 409);
      metricValueId = fresh.id;
    } else {
      const created = await tx.metricValue.create({
        data: {
          metricDefinitionId: definition.id, period, dimensionsHash, dimensionsJson: {},
          valueText: record.valueText,
          valueNumber: definition.valueType === "NUMBER" ? record.valueText : null,
          sourceVersion: String(record.version), sourceUpdatedAt: new Date(record.updatedAt)
        }
      });
      metricValueId = created.id;
    }
    const usernames = [...new Set(changes.map((change) => change.updatedBy))];
    const users = await tx.user.findMany({ where: { username: { in: usernames } }, select: { id: true, username: true } });
    const userIds = new Map(users.map((user) => [user.username, user.id]));
    for (const change of changes) {
      await tx.metricValueHistory.create({
        data: {
          metricValueId,
          oldValueJson: { valueText: change.oldValueText, sourceVersion: change.oldVersion },
          newValueJson: { valueText: change.newValueText, sourceVersion: change.newVersion, sourceUpdatedBy: change.updatedBy },
          reason: change.reason,
          operatorId: userIds.get(change.updatedBy) ?? actorId,
          expectedVersion: change.oldVersion
        }
      });
    }
    await tx.operationLog.create({
      data: {
        actorId,
        action: "METRIC_VALUE_RECONCILED",
        resourceType: "MetricDefinition",
        resourceId: definition.id,
        correlationId: randomUUID(),
        metadataJson: { period, fromVersion, throughVersion: record.version, appliedChanges: changes.length }
      }
    });
  });
  return { metric: publicMetric(record, definition), appliedChanges: changes.length };
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

async function availablePeriods(year: string) {
  const definitions = await prisma.metricDefinition.findMany({
    where: { dataSource: { status: "ACTIVE" } },
    include: { dataSource: true }
  });
  const groups = new Map<string, { source: DefinitionWithSource["dataSource"]; sourceCode: string; codes: Set<string> }>();
  for (const definition of definitions) {
    const mapping = demoQueryConfigSchema.safeParse(definition.queryConfigJson);
    if (!mapping.success) continue;
    const key = `${definition.dataSourceId}:${mapping.data.sourceCode}`;
    const group = groups.get(key) ?? { source: definition.dataSource, sourceCode: mapping.data.sourceCode, codes: new Set<string>() };
    group.codes.add(definition.code);
    groups.set(key, group);
  }
  try {
    const results = await Promise.all([...groups.values()].map((group) => adapterFor(group.source).listAvailablePeriods({
      year, sourceCode: group.sourceCode, metricCodes: [...group.codes]
    })));
    return [...new Set(results.flat())].filter((period) => periodSchema.safeParse(period).success && period.startsWith(`${year}-`)).sort();
  } catch (error) {
    if (error instanceof MetricServiceError) throw error;
    throw new MetricServiceError("DATASOURCE_UNAVAILABLE", "指标数据源暂时不可用", 503);
  }
}

export async function availableMetricPeriodsForCollector(yearInput: unknown) {
  await requireCollector();
  const year = metricYearSchema.parse(yearInput);
  return { year, periods: await availablePeriods(year) };
}

export async function availableMetricPeriodsForInstance(instanceId: string, yearInput: unknown) {
  await getFillInstance(instanceId);
  const year = metricYearSchema.parse(yearInput);
  return { year, periods: await availablePeriods(year) };
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

const CATALOG_PAGE_SIZE = 20;

export async function listMetricCatalog(input: { period: unknown; page: unknown; search: unknown }) {
  await requireCollector();
  const { period, page, search } = metricCatalogQuerySchema.parse(input);
  const where: Prisma.MetricDefinitionWhereInput = {
    dataSource: { status: "ACTIVE" },
    ...(search ? { OR: [
      { name: { contains: search } },
      { code: { contains: search } },
      { dataSource: { name: { contains: search } } }
    ] } : {})
  };
  const [total, definitions] = await Promise.all([
    prisma.metricDefinition.count({ where }),
    prisma.metricDefinition.findMany({
      where,
      include: { dataSource: true },
      orderBy: [{ dataSource: { name: "asc" } }, { name: "asc" }, { code: "asc" }, { id: "asc" }],
      skip: (page - 1) * CATALOG_PAGE_SIZE,
      take: CATALOG_PAGE_SIZE
    })
  ]);

  const groups = new Map<string, { source: DefinitionWithSource["dataSource"]; sourceCode: string; codes: Set<string> }>();
  for (const definition of definitions) {
    const mapping = demoQueryConfigSchema.safeParse(definition.queryConfigJson);
    if (!mapping.success) continue;
    const key = JSON.stringify([definition.dataSourceId, mapping.data.sourceCode]);
    const group = groups.get(key) ?? { source: definition.dataSource, sourceCode: mapping.data.sourceCode, codes: new Set<string>() };
    group.codes.add(definition.code);
    groups.set(key, group);
  }

  const recordsByGroup = new Map<string, Map<string, MetricRecord>>();
  try {
    await Promise.all([...groups].map(async ([key, group]) => {
      const records = await adapterFor(group.source).queryMetrics({ period, sourceCode: group.sourceCode, metricCodes: [...group.codes] });
      recordsByGroup.set(key, new Map(records.map((record) => [record.metricCode, record])));
    }));
  } catch (error) {
    if (error instanceof MetricServiceError) throw error;
    throw new MetricServiceError("DATASOURCE_UNAVAILABLE", "指标数据源暂时不可用", 503);
  }

  return {
    period, page, pageSize: CATALOG_PAGE_SIZE, total,
    items: definitions.map((definition) => {
      const mapping = demoQueryConfigSchema.safeParse(definition.queryConfigJson);
      const key = mapping.success ? JSON.stringify([definition.dataSourceId, mapping.data.sourceCode]) : "";
      const record = recordsByGroup.get(key)?.get(definition.code);
      return {
        definitionId: definition.id,
        code: definition.code,
        name: definition.name,
        dataSource: { id: definition.dataSource.id, name: definition.dataSource.name },
        writable: definition.writable,
        metric: record ? publicMetric(record, definition) : null
      };
    })
  };
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
  try {
    await reconcileMirror(definition, parsed.period, actor.id);
  } catch {
    throw new MetricServiceError("SYNC_PENDING", "源库已修改，平台镜像待同步；请勿直接重试修改", 503);
  }
  return publicMetric(change, definition);
}

export async function reconcileMetricValue(definitionId: string, periodInput: unknown) {
  const actor = await requireCollector();
  const period = periodSchema.parse(periodInput);
  const definition = await prisma.metricDefinition.findUnique({ where: { id: definitionId }, include: { dataSource: true } });
  if (!definition) throw new MetricServiceError("NOT_FOUND", "指标不存在", 404);
  try {
    return await reconcileMirror(definition, period, actor.id);
  } catch (error) {
    if (error instanceof MetricServiceError) throw error;
    throw new MetricServiceError("DATASOURCE_UNAVAILABLE", "指标同步失败，请检查源库和平台库", 503);
  }
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
