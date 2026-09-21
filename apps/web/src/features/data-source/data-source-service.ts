import { randomUUID } from "node:crypto";

import { Prisma, prisma } from "@report-platform/database";

import { requireCollector } from "@/features/auth/authorization";

import { decryptPassword, encryptPassword } from "./credential";
import { createDataSourceSchema } from "./data-source-policy";
import { MySqlMetricDataSource } from "./mysql-adapter";

export class DataSourceError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message);
    this.name = "DataSourceError";
  }
}

const publicFields = {
  id: true,
  name: true,
  type: true,
  status: true,
  host: true,
  port: true,
  databaseName: true,
  username: true,
  createdAt: true,
  updatedAt: true
} as const;

export async function listDataSources() {
  await requireCollector();
  return prisma.dataSource.findMany({ select: publicFields, orderBy: { createdAt: "desc" } });
}

export async function createDataSource(input: unknown) {
  const actor = await requireCollector();
  const parsed = createDataSourceSchema.parse(input);
  let secret;
  try {
    secret = encryptPassword(parsed.password);
  } catch {
    throw new DataSourceError("ENCRYPTION_UNAVAILABLE", "数据源加密配置不可用", 503);
  }
  try {
    return await prisma.$transaction(async (tx) => {
      const dataSource = await tx.dataSource.create({
        data: {
          name: parsed.name,
          type: "MYSQL",
          status: "ACTIVE",
          host: parsed.host,
          port: parsed.port,
          databaseName: parsed.databaseName,
          username: parsed.username,
          ...secret,
          createdById: actor.id
        },
        select: publicFields
      });
      await tx.operationLog.create({
        data: {
          actorId: actor.id,
          action: "DATA_SOURCE_CREATED",
          resourceType: "DataSource",
          resourceId: dataSource.id,
          correlationId: randomUUID(),
          afterJson: { name: dataSource.name, type: dataSource.type }
        }
      });
      return dataSource;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new DataSourceError("DATA_SOURCE_EXISTS", "数据源名称已存在", 409);
    }
    throw error;
  }
}

export async function testDataSource(dataSourceId: string) {
  const actor = await requireCollector();
  const source = await prisma.dataSource.findUnique({ where: { id: dataSourceId } });
  if (!source) throw new DataSourceError("NOT_FOUND", "数据源不存在", 404);
  if (source.type !== "MYSQL" || !source.host || !source.port || !source.databaseName || !source.username || !source.encryptedPassword || !source.encryptionKeyVersion) {
    throw new DataSourceError("DATA_SOURCE_INVALID", "数据源配置不完整", 409);
  }
  let result;
  try {
    const password = decryptPassword(source.encryptedPassword, source.encryptionKeyVersion);
    result = await new MySqlMetricDataSource({
      host: source.host,
      port: source.port,
      databaseName: source.databaseName,
      username: source.username,
      password
    }).testConnection();
  } catch {
    await prisma.operationLog.create({
      data: {
        actorId: actor.id,
        action: "DATA_SOURCE_TEST_FAILED",
        resourceType: "DataSource",
        resourceId: source.id,
        correlationId: randomUUID()
      }
    });
    throw new DataSourceError("DATASOURCE_UNAVAILABLE", "指标数据源连接失败，请检查配置或网络", 503);
  }
  await prisma.operationLog.create({
    data: {
      actorId: actor.id,
      action: "DATA_SOURCE_TEST_SUCCEEDED",
      resourceType: "DataSource",
      resourceId: source.id,
      correlationId: randomUUID(),
      metadataJson: { latencyMs: result.latencyMs }
    }
  });
  return result;
}
