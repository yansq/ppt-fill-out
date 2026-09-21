import { createCipheriv, randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

import mysql from "mysql2/promise";

const databaseRequire = createRequire(new URL("../../../packages/database/package.json", import.meta.url));
const { PrismaClient } = databaseRequire("@prisma/client");

const DATABASE_NAME = "report_metrics_demo";
const SOURCE_NAME = "P4 测试指标库";
const SOURCE_CODE = "demo";
const definitions = [
  { code: "monthly_revenue", name: "月营业收入", valueType: "NUMBER", unit: "万元", values: ["1280.50", "1356.80", "1422.10", "1198.30"] },
  { code: "active_customers", name: "活跃客户数", valueType: "NUMBER", unit: "户", values: ["526", "548", "571", "493"] },
  { code: "service_summary", name: "服务工作摘要", valueType: "STRING", unit: null, values: ["完成重点客户走访", "完成网点服务优化", "推进数字化服务", "持续改善客户体验"] }
];
const periods = ["2025-11", "2026-08", "2026-09", "2026-10"];

const databaseUrl = process.env.DATABASE_URL;
const encodedKey = process.env.ENCRYPTION_KEY;
const keyVersion = process.env.ENCRYPTION_KEY_VERSION || "v1";
if (!databaseUrl || !encodedKey) throw new Error("DATABASE_URL and ENCRYPTION_KEY are required");
const key = Buffer.from(encodedKey, "base64");
if (key.length !== 32 || key.toString("base64") !== encodedKey) throw new Error("ENCRYPTION_KEY must be base64-encoded 32 bytes");
if (!/^[A-Za-z0-9_-]{1,64}$/.test(keyVersion)) throw new Error("Invalid ENCRYPTION_KEY_VERSION");
const parsed = new URL(databaseUrl);
if (parsed.protocol !== "mysql:") throw new Error("DATABASE_URL must use mysql:");
const connectionOptions = {
  host: parsed.hostname,
  port: Number(parsed.port || 3306),
  user: decodeURIComponent(parsed.username),
  password: decodeURIComponent(parsed.password),
  connectTimeout: 5000,
  multipleStatements: false
};
const dataSourceHost = process.env.P4_DEMO_SOURCE_HOST || connectionOptions.host;

function encryptPassword(password) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(keyVersion));
  const encrypted = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}

const prisma = new PrismaClient();
let connection;
try {
  const collector = await prisma.user.findUnique({ where: { username: "admin" }, select: { id: true } });
  if (!collector) throw new Error("Collector admin is required; run seed:auth first");
  connection = await mysql.createConnection(connectionOptions);
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DATABASE_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.query(`USE \`${DATABASE_NAME}\``);
  const schema = await readFile(new URL("../../../examples/metric-demo/schema.sql", import.meta.url), "utf8");
  for (const statement of schema.split(";").map((item) => item.trim()).filter(Boolean)) {
    await connection.query(statement);
  }
  for (const definition of definitions) {
    for (const [index, period] of periods.entries()) {
      await connection.execute(
        "INSERT IGNORE INTO metric_record (data_source_code, metric_code, metric_name, value_text, value_type, unit, period, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [SOURCE_CODE, definition.code, definition.name, definition.values[index], definition.valueType, definition.unit, period, "p4-seed"]
      );
    }
  }
  let source = await prisma.dataSource.findUnique({ where: { name: SOURCE_NAME } });
  if (source && (source.databaseName !== DATABASE_NAME || source.host !== dataSourceHost)) {
    throw new Error("Existing demo data source points elsewhere; refusing to overwrite it");
  }
  if (!source) {
    source = await prisma.dataSource.create({
      data: {
        name: SOURCE_NAME,
        type: "MYSQL",
        status: "ACTIVE",
        host: dataSourceHost,
        port: connectionOptions.port,
        databaseName: DATABASE_NAME,
        username: connectionOptions.user,
        encryptedPassword: encryptPassword(connectionOptions.password),
        encryptionKeyVersion: keyVersion,
        createdById: collector.id
      }
    });
  }
  for (const definition of definitions) {
    await prisma.metricDefinition.upsert({
      where: { dataSourceId_code: { dataSourceId: source.id, code: definition.code } },
      update: {},
      create: {
        id: randomUUID(),
        dataSourceId: source.id,
        code: definition.code,
        name: definition.name,
        valueType: definition.valueType,
        unit: definition.unit,
        writable: true,
        queryConfigJson: { adapter: "demo_metric_record", sourceCode: SOURCE_CODE },
        updateConfigJson: { adapter: "demo_metric_record", sourceCode: SOURCE_CODE }
      }
    });
  }
  const demoTaskName = "P4 示例填报任务";
  let demoTask = await prisma.reportTask.findFirst({ where: { name: demoTaskName, collectorId: collector.id } });
  if (!demoTask) {
    const filler = await prisma.user.findUnique({ where: { username: "aaa" }, include: { roles: { include: { role: true } } } });
    const template = await prisma.reportTemplate.findFirst({
      where: { createdById: collector.id, status: "READY" },
      include: { slides: { include: { placeholders: { select: { id: true } } }, orderBy: { slideIndex: "asc" } } }
    });
    const slide = template?.slides.find((item) => item.placeholders.length >= 2);
    if (filler?.status === "ACTIVE" && filler.roles.some(({ role }) => role.code === "FILLER") && slide) {
      demoTask = await prisma.$transaction(async (tx) => {
        const task = await tx.reportTask.create({
          data: { name: demoTaskName, templateId: template.id, reportPeriod: "2026-09", collectorId: collector.id, status: "FILLING", version: 1 }
        });
        const assignment = await tx.slideAssignment.create({
          data: { taskId: task.id, templateSlideId: slide.id, assigneeId: filler.id, createdById: collector.id }
        });
        await tx.fillInstance.create({
          data: { assignmentId: assignment.id, taskId: task.id, templateSlideId: slide.id, assigneeId: filler.id }
        });
        await tx.operationLog.create({
          data: {
            actorId: collector.id, action: "P4_DEMO_TASK_SEEDED", resourceType: "ReportTask",
            resourceId: task.id, taskId: task.id, correlationId: randomUUID()
          }
        });
        return task;
      });
    }
  }
  process.stdout.write(`Demo metric source ready: ${DATABASE_NAME}, ${definitions.length} metrics, ${periods.length} periods.${demoTask ? ` Example task: ${demoTask.id}.` : " Example task skipped (needs READY admin template and active aaa Filler)."}\n`);
} finally {
  await connection?.end();
  await prisma.$disconnect();
}
