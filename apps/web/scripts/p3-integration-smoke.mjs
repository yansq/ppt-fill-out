import assert from "node:assert/strict";
import { randomBytes, randomUUID, scrypt as scryptCallback } from "node:crypto";
import { createRequire } from "node:module";
import { promisify } from "node:util";

const databaseRequire = createRequire(new URL("../../../packages/database/package.json", import.meta.url));
const { PrismaClient } = databaseRequire("@prisma/client");

const scrypt = promisify(scryptCallback);
const prisma = new PrismaClient();
const baseUrl = process.env.P3_SMOKE_BASE_URL;
const collectorEmail = process.env.P3_SMOKE_COLLECTOR_EMAIL;
if (!baseUrl || !collectorEmail?.endsWith("@local.test")) {
  throw new Error("Set P3_SMOKE_BASE_URL and a dedicated @local.test P3_SMOKE_COLLECTOR_EMAIL");
}

async function passwordHash(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

async function login(employeeNumber, password) {
  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`);
  assert.equal(csrfResponse.status, 200);
  const { csrfToken } = await csrfResponse.json();
  const csrfCookies = csrfResponse.headers.getSetCookie().map((value) => value.split(";")[0]);
  const response = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: csrfCookies.join("; ")
    },
    body: new URLSearchParams({ csrfToken, employeeNumber, password, callbackUrl: baseUrl })
  });
  assert.equal(response.status, 302, `login failed for ${employeeNumber}`);
  const sessionCookie = response.headers.getSetCookie()
    .map((value) => value.split(";")[0])
    .find((value) => value.includes("authjs.session-token="));
  assert.ok(sessionCookie, `session cookie missing for ${employeeNumber}`);
  return sessionCookie;
}

async function api(cookie, method, path, body, expectedStatus) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Cookie: cookie,
      ...(body === undefined ? {} : { "Content-Type": "application/json" })
    },
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
let collectorId;
const fillerIds = [];
try {
  const collector = await prisma.user.findUnique({
    where: { email: collectorEmail },
    include: { credential: true, roles: { include: { role: true } } }
  });
  assert.ok(collector && !collector.credential && collector.roles.some(({ role }) => role.code === "COLLECTOR"),
    "smoke Collector must exist, have COLLECTOR role and have no existing credential");
  collectorId = collector.id;
  const template = await prisma.reportTemplate.findFirst({
    where: { createdById: collector.id, status: "READY" },
    include: { slides: { orderBy: { slideIndex: "asc" }, take: 1 } }
  });
  assert.ok(template?.slides.length, "smoke Collector needs one READY template");
  const role = await prisma.role.findUniqueOrThrow({ where: { code: "FILLER" } });
  const collectorPassword = randomBytes(24).toString("hex");
  const fillerPasswords = [randomBytes(24).toString("hex"), randomBytes(24).toString("hex")];
  await prisma.userCredential.create({
    data: { userId: collector.id, passwordHash: await passwordHash(collectorPassword) }
  });
  for (let index = 0; index < 2; index++) {
    const filler = await prisma.user.create({
      data: {
        email: `p3-smoke-${randomUUID()}@local.test`,
        employeeNumber: `9${String(Date.now() + index).slice(-5)}`,
        username: `p3-smoke-${randomUUID()}`,
        name: `P3 Smoke Filler ${index + 1}`,
        credential: { create: { passwordHash: await passwordHash(fillerPasswords[index]) } },
        roles: { create: { roleId: role.id } }
      }
    });
    fillerIds.push(filler.id);
  }

  const collectorCookie = await login(collector.employeeNumber, collectorPassword);
  const fillerCookies = [];
  for (let index = 0; index < 2; index++) {
    const filler = await prisma.user.findUniqueOrThrow({ where: { id: fillerIds[index] } });
    fillerCookies.push(await login(filler.employeeNumber, fillerPasswords[index]));
  }
  await api(fillerCookies[0], "POST", "/api/report-tasks", {
    name: "forbidden", templateId: template.id, reportPeriod: "2026-09"
  }, 403);
  const created = await api(collectorCookie, "POST", "/api/report-tasks", {
    name: `P3 smoke ${randomUUID()}`,
    templateId: template.id,
    reportPeriod: "2026-09"
  }, 201);
  taskId = created.task.id;
  assert.equal(created.task.status, "DRAFT");
  await page(collectorCookie, "/report-tasks");
  await page(collectorCookie, `/report-tasks/${taskId}`);
  const slideId = created.task.slides[0].id;
  await api(collectorCookie, "PUT", `/api/report-tasks/${taskId}/assignments`, {
    expectedVersion: 0,
    assignments: [{ slideId: "foreign-slide", assigneeId: fillerIds[0] }]
  }, 400);
  await api(collectorCookie, "PUT", `/api/report-tasks/${taskId}/assignments`, {
    expectedVersion: 0,
    assignments: [{ slideId, assigneeId: collectorId }]
  }, 400);
  const assigned = await api(collectorCookie, "PUT", `/api/report-tasks/${taskId}/assignments`, {
    expectedVersion: created.task.version,
    assignments: fillerIds.map((assigneeId) => ({ slideId, assigneeId }))
  }, 200);
  assert.equal(assigned.task.status, "FILLING");
  assert.equal(assigned.task.progress.total, 2);
  const mine = [];
  for (const cookie of fillerCookies) {
    const result = await api(cookie, "GET", "/api/fill-instances/mine", undefined, 200);
    assert.equal(result.instances.length, 1);
    mine.push(result.instances[0].id);
  }
  assert.notEqual(mine[0], mine[1], "same slide must produce independent FillInstances");
  await page(fillerCookies[0], "/my-tasks");
  await page(fillerCookies[0], `/fill-instances/${mine[0]}`);
  await api(fillerCookies[0], "GET", `/api/fill-instances/${mine[1]}`, undefined, 404);
  await api(fillerCookies[0], "GET", `/api/report-tasks/${taskId}`, undefined, 403);
  await api(collectorCookie, "GET", `/api/fill-instances/${mine[0]}`, undefined, 200);
  await api(collectorCookie, "PUT", `/api/report-tasks/${taskId}/assignments`, {
    expectedVersion: 0,
    assignments: fillerIds.map((assigneeId) => ({ slideId, assigneeId }))
  }, 409);
  const started = await api(fillerCookies[0], "POST", `/api/fill-instances/${mine[0]}/start`, {
    expectedVersion: 0
  }, 200);
  assert.equal(started.instance.status, "IN_PROGRESS");
  await api(collectorCookie, "PUT", `/api/report-tasks/${taskId}/assignments`, {
    expectedVersion: assigned.task.version,
    assignments: [{ slideId, assigneeId: fillerIds[1] }]
  }, 409);
  const progress = await api(collectorCookie, "GET", `/api/report-tasks/${taskId}`, undefined, 200);
  assert.deepEqual(progress.task.progress, { total: 2, started: 1, submitted: 0, percent: 0 });
  await prisma.userRole.deleteMany({ where: { userId: fillerIds[0], roleId: role.id } });
  await api(fillerCookies[0], "GET", "/api/fill-instances/mine", undefined, 403);
  await api(fillerCookies[0], "GET", `/api/fill-instances/${mine[0]}`, undefined, 404);
  const visibleTemplates = await api(fillerCookies[0], "GET", "/api/templates", undefined, 200);
  assert.equal(visibleTemplates.templates.length, 0);
  process.stdout.write("P3 smoke passed: create, validation, page rendering, multi-filler isolation, authorization and role revocation, version conflict, start, guarded revoke, progress.\n");
} finally {
  if (taskId) {
    await prisma.operationLog.deleteMany({ where: { taskId } });
    await prisma.fillInstance.deleteMany({ where: { taskId } });
    await prisma.slideAssignment.deleteMany({ where: { taskId } });
    await prisma.reportTask.delete({ where: { id: taskId } });
  }
  for (const id of fillerIds) await prisma.user.delete({ where: { id } });
  if (collectorId) await prisma.userCredential.deleteMany({ where: { userId: collectorId } });
  await prisma.$disconnect();
}
