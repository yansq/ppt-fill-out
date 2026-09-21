import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

const databaseRequire = createRequire(new URL("../../../packages/database/package.json", import.meta.url));
const { PrismaClient } = databaseRequire("@prisma/client");
const prisma = new PrismaClient();

const baseUrl = process.env.P4_SMOKE_BASE_URL;
const adminPassword = process.env.P4_SMOKE_ADMIN_PASSWORD;
const fillerPassword = process.env.P4_SMOKE_FILLER_PASSWORD;
const outsiderPassword = process.env.P4_SMOKE_OUTSIDER_PASSWORD;
if (!baseUrl || !adminPassword || !fillerPassword || !outsiderPassword) {
  throw new Error("Set P4_SMOKE_BASE_URL and admin/filler/outsider password variables");
}

async function login(username, password) {
  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`);
  assert.equal(csrfResponse.status, 200);
  const { csrfToken } = await csrfResponse.json();
  const csrfCookies = csrfResponse.headers.getSetCookie().map((value) => value.split(";")[0]);
  const response = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: "POST", redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: csrfCookies.join("; ") },
    body: new URLSearchParams({ csrfToken, username, password, callbackUrl: baseUrl })
  });
  assert.equal(response.status, 302, `login failed for ${username}`);
  const cookie = response.headers.getSetCookie().map((value) => value.split(";")[0])
    .find((value) => value.includes("authjs.session-token="));
  assert.ok(cookie, `session cookie missing for ${username}`);
  return cookie;
}

async function api(cookie, method, path, body, expectedStatus) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { Cookie: cookie, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json();
  assert.equal(response.status, expectedStatus, `${method} ${path}: ${JSON.stringify(payload)}`);
  return payload;
}

async function page(cookie, path) {
  const response = await fetch(`${baseUrl}${path}`, { headers: { Cookie: cookie }, redirect: "manual" });
  assert.equal(response.status, 200, `page ${path} did not render`);
}

let taskId;
let changedMetric;
let originalValue;
try {
  const admin = await login("admin", adminPassword);
  const filler = await login("aaa", fillerPassword);
  const outsider = await login("bbb", outsiderPassword);
  await page(admin, "/data-sources");
  await page(admin, "/metrics");
  const template = await prisma.reportTemplate.findFirst({
    where: { createdBy: { username: "admin" }, status: "READY" },
    include: { slides: { include: { placeholders: true }, orderBy: { slideIndex: "asc" } } }
  });
  assert.ok(template, "admin needs a READY template");
  const slide = template.slides.find((item) => item.placeholders.length >= 2);
  assert.ok(slide, "smoke requires a slide with at least two placeholders");
  const fillerUser = await prisma.user.findUniqueOrThrow({ where: { username: "aaa" } });

  const created = await api(admin, "POST", "/api/report-tasks", {
    name: `P4 冒烟 ${randomUUID()}`, templateId: template.id, reportPeriod: "2026-09"
  }, 201);
  taskId = created.task.id;
  const assigned = await api(admin, "PUT", `/api/report-tasks/${taskId}/assignments`, {
    expectedVersion: created.task.version,
    assignments: [{ slideId: slide.id, assigneeId: fillerUser.id }]
  }, 200);
  const instanceId = assigned.task.slides.find((item) => item.id === slide.id).assignments[0].fillInstance.id;
  await api(outsider, "GET", `/api/fill-instances/${instanceId}`, undefined, 404);
  const started = await api(filler, "POST", `/api/fill-instances/${instanceId}/start`, { expectedVersion: 0 }, 200);
  await page(filler, `/fill-instances/${instanceId}`);
  const metrics = await api(filler, "GET", `/api/fill-instances/${instanceId}/metrics?period=2026-08`, undefined, 200);
  assert.equal(metrics.reportPeriod, "2026-09");
  assert.equal(metrics.viewPeriod, "2026-08");
  assert.equal(metrics.historical, true);
  const metric = metrics.items.find((item) => item.code === "monthly_revenue");
  assert.ok(metric, "demo metric missing");
  originalValue = metric.valueText;

  const first = await api(filler, "PUT", `/api/fill-instances/${instanceId}/bindings/${slide.placeholders[0].id}`, {
    expectedVersion: started.instance.version,
    sourceType: "DATABASE_METRIC", metricDefinitionId: metric.definitionId, metricPeriod: "2026-08"
  }, 200);
  assert.equal(first.instance.task.reportPeriod, "2026-09");
  await api(filler, "POST", `/api/fill-instances/${instanceId}/submit`, { expectedVersion: first.instance.version }, 400);
  await api(filler, "PUT", `/api/fill-instances/${instanceId}/bindings/${slide.placeholders[1].id}`, {
    expectedVersion: started.instance.version, sourceType: "MANUAL_TEXT", manualValue: "过期提交"
  }, 409);
  let version = first.instance.version;
  for (const placeholder of slide.placeholders.slice(1)) {
    const result = await api(filler, "PUT", `/api/fill-instances/${instanceId}/bindings/${placeholder.id}`, {
      expectedVersion: version, sourceType: "MANUAL_TEXT", manualValue: `人工值 ${placeholder.key}`
    }, 200);
    version = result.instance.version;
  }
  await api(outsider, "POST", `/api/fill-instances/${instanceId}/submit`, { expectedVersion: version }, 404);
  await api(filler, "POST", `/api/fill-instances/${instanceId}/submit`, { expectedVersion: version }, 200);
  await api(filler, "PUT", `/api/fill-instances/${instanceId}/bindings/${slide.placeholders[0].id}`, {
    expectedVersion: version + 1, sourceType: "MANUAL_TEXT", manualValue: "提交后篡改"
  }, 409);
  await page(filler, `/fill-instances/${instanceId}`);
  const submitted = await prisma.submittedValue.findMany({ where: { fillInstanceId: instanceId } });
  assert.equal(submitted.length, slide.placeholders.length);
  const frozen = submitted.find((item) => item.placeholderId === slide.placeholders[0].id);
  assert.equal(frozen.valueText, originalValue);
  assert.equal(frozen.sourceSnapshotJson.period, "2026-08");

  const changedValue = String(Number(originalValue) + 1);
  const changed = await api(admin, "PUT", `/api/metrics/${metric.definitionId}`, {
    period: "2026-08", value: changedValue, expectedVersion: metric.version, reason: "P4 冒烟测试修正"
  }, 200);
  changedMetric = changed.metric;
  await api(admin, "PUT", `/api/metrics/${metric.definitionId}`, {
    period: "2026-08", value: "9999", expectedVersion: metric.version, reason: "故意使用过期版本"
  }, 409);
  const history = await api(admin, "GET", `/api/metrics/${metric.definitionId}/history?period=2026-08`, undefined, 200);
  assert.ok(history.items.some((item) => item.newValueText === changedValue && item.reason === "P4 冒烟测试修正"));
  const stillFrozen = await prisma.submittedValue.findUniqueOrThrow({ where: { id: frozen.id } });
  assert.equal(stillFrozen.valueText, originalValue);
  process.stdout.write("P4 smoke: role isolation, period separation, binding conflict, submission snapshot, metric history and source-version conflict passed.\n");

  await api(admin, "PUT", `/api/metrics/${metric.definitionId}`, {
    period: "2026-08", value: originalValue, expectedVersion: changed.metric.version, reason: "恢复冒烟前测试值"
  }, 200);
  changedMetric = undefined;
} finally {
  if (changedMetric && originalValue) {
    process.stderr.write("Metric was changed by smoke and not restored; check metric_record before rerunning.\n");
  }
  if (taskId) {
    await prisma.$transaction(async (tx) => {
      const instances = await tx.fillInstance.findMany({ where: { taskId }, select: { id: true } });
      const instanceIds = instances.map((item) => item.id);
      await tx.submittedValue.deleteMany({ where: { fillInstanceId: { in: instanceIds } } });
      await tx.placeholderBinding.deleteMany({ where: { fillInstanceId: { in: instanceIds } } });
      await tx.operationLog.deleteMany({ where: { taskId } });
      await tx.fillInstance.deleteMany({ where: { taskId } });
      await tx.slideAssignment.deleteMany({ where: { taskId } });
      await tx.reportTask.delete({ where: { id: taskId } });
    });
  }
  await prisma.$disconnect();
}
