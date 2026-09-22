import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

const databaseRequire = createRequire(new URL("../../../packages/database/package.json", import.meta.url));
const { PrismaClient } = databaseRequire("@prisma/client");
const prisma = new PrismaClient();
const baseUrl = process.env.P5_SMOKE_BASE_URL;
if (!baseUrl || !process.env.P5_SMOKE_ADMIN_PASSWORD || !process.env.P5_SMOKE_FILLER_PASSWORD) {
  throw new Error("Set P5_SMOKE_BASE_URL and admin/filler passwords");
}

async function login(username, password) {
  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`);
  const { csrfToken } = await csrfResponse.json();
  const csrfCookies = csrfResponse.headers.getSetCookie().map((value) => value.split(";")[0]);
  const response = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: "POST", redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: csrfCookies.join("; ") },
    body: new URLSearchParams({ csrfToken, username, password, callbackUrl: baseUrl })
  });
  assert.equal(response.status, 302, `login failed for ${username}`);
  const cookie = response.headers.getSetCookie().map((value) => value.split(";")[0]).find((value) => value.includes("authjs.session-token="));
  assert.ok(cookie);
  return cookie;
}

async function api(cookie, method, path, body, status) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { Cookie: cookie, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json();
  assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(payload)}`);
  return payload;
}

let taskId;
try {
  const admin = await login("admin", process.env.P5_SMOKE_ADMIN_PASSWORD);
  const aaa = await login("aaa", process.env.P5_SMOKE_FILLER_PASSWORD);
  const bbb = await login("bbb", process.env.P5_SMOKE_FILLER_PASSWORD);
  const template = await prisma.reportTemplate.findFirst({
    where: { createdBy: { username: "admin" }, status: "READY" },
    include: { slides: { include: { placeholders: true }, orderBy: { slideIndex: "asc" } } }
  });
  assert.ok(template);
  const slide = template.slides.find((item) => item.placeholders.length >= 2);
  assert.ok(slide);
  const users = await prisma.user.findMany({ where: { username: { in: ["aaa", "bbb"] } } });
  const userId = (name) => users.find((user) => user.username === name).id;
  const created = await api(admin, "POST", "/api/report-tasks", { name: `P5 冒烟 ${randomUUID()}`, templateId: template.id, reportPeriod: "2026-09" }, 201);
  taskId = created.task.id;
  await api(admin, "PUT", `/api/report-tasks/${taskId}/assignments`, {
    expectedVersion: created.task.version,
    assignments: [{ slideId: slide.id, assigneeId: userId("aaa") }, { slideId: slide.id, assigneeId: userId("bbb") }]
  }, 200);
  const instances = await prisma.fillInstance.findMany({ where: { taskId }, include: { assignee: true } });
  const instance = (name) => instances.find((item) => item.assignee.username === name);

  for (const [name, cookie] of [["aaa", aaa], ["bbb", bbb]]) {
    const fill = instance(name);
    let result = await api(cookie, "POST", `/api/fill-instances/${fill.id}/start`, { expectedVersion: fill.version }, 200);
    for (const placeholder of slide.placeholders) {
      result = await api(cookie, "PUT", `/api/fill-instances/${fill.id}/bindings/${placeholder.id}`, {
        expectedVersion: result.instance.version, sourceType: "MANUAL_TEXT", manualValue: `${name}-${placeholder.key}`
      }, 200);
    }
    await api(cookie, "POST", `/api/fill-instances/${fill.id}/submit`, { expectedVersion: result.instance.version }, 200);
  }

  let review = await api(admin, "GET", `/api/report-tasks/${taskId}/review`, undefined, 200);
  assert.equal(review.task.status, "REVIEWING");
  assert.equal(review.slides[0].placeholders[0].status, "CONFLICT");
  const reviewPage = await fetch(`${baseUrl}/report-tasks/${taskId}`, { headers: { Cookie: admin } });
  assert.equal(reviewPage.status, 200, "review page did not render");
  assert.match(await reviewPage.text(), /多人提交审核/);
  await api(aaa, "GET", `/api/report-tasks/${taskId}/review`, undefined, 403);
  await api(admin, "POST", `/api/report-tasks/${taskId}/review`, { expectedVersion: review.task.version }, 409);
  const firstPlaceholder = review.slides[0].placeholders[0];
  review = await api(admin, "PUT", `/api/report-tasks/${taskId}/final-values/${firstPlaceholder.id}`, {
    expectedVersion: review.task.version, resolutionType: "SELECTED_SUBMISSION", selectedSubmittedValueId: firstPlaceholder.submissions[0].id
  }, 200);
  await api(admin, "PUT", `/api/report-tasks/${taskId}/final-values/${firstPlaceholder.id}`, {
    expectedVersion: review.task.version - 1, resolutionType: "MANUAL", valueText: "过期审核"
  }, 409);

  review = await api(admin, "POST", `/api/report-tasks/${taskId}/fill-instances/${instance("bbb").id}/return`, {
    expectedVersion: review.task.version, reason: "请核对数据"
  }, 200);
  assert.equal(review.task.status, "FILLING");
  assert.equal(review.slides[0].placeholders[0].finalValue, null);
  const returned = await prisma.fillInstance.findUniqueOrThrow({ where: { id: instance("bbb").id } });
  const returnedDetail = await api(bbb, "GET", `/api/fill-instances/${returned.id}`, undefined, 200);
  assert.equal(returnedDetail.instance.returnReason, "请核对数据");
  let fill = await api(bbb, "POST", `/api/fill-instances/${returned.id}/start`, { expectedVersion: returned.version }, 200);
  for (const placeholder of slide.placeholders) {
    fill = await api(bbb, "PUT", `/api/fill-instances/${returned.id}/bindings/${placeholder.id}`, {
      expectedVersion: fill.instance.version, sourceType: "MANUAL_TEXT", manualValue: `aaa-${placeholder.key}`
    }, 200);
  }
  await api(bbb, "POST", `/api/fill-instances/${returned.id}/submit`, { expectedVersion: fill.instance.version }, 200);
  review = await api(admin, "GET", `/api/report-tasks/${taskId}/review`, undefined, 200);
  assert.equal(review.task.status, "REVIEWING");
  assert.equal(review.slides[0].placeholders[0].status, "CONSISTENT");
  for (const placeholder of review.slides[0].placeholders) {
    review = await api(admin, "PUT", `/api/report-tasks/${taskId}/final-values/${placeholder.id}`, {
      expectedVersion: review.task.version, resolutionType: "MANUAL", valueText: `最终-${placeholder.key}`
    }, 200);
  }
  review = await api(admin, "POST", `/api/report-tasks/${taskId}/review`, { expectedVersion: review.task.version }, 200);
  assert.equal(review.task.status, "COMPLETED");
  assert.ok(review.slides[0].instances.every((item) => item.status === "REVIEWED"));
  process.stdout.write("P5 smoke: aggregation, conflict, authorization, stale review, return/revision, final invalidation and completion passed.\n");
} finally {
  if (taskId) await prisma.$transaction(async (tx) => {
    const ids = (await tx.fillInstance.findMany({ where: { taskId }, select: { id: true } })).map((item) => item.id);
    await tx.finalValue.deleteMany({ where: { taskId } });
    await tx.submittedValue.deleteMany({ where: { fillInstanceId: { in: ids } } });
    await tx.placeholderBinding.deleteMany({ where: { fillInstanceId: { in: ids } } });
    await tx.operationLog.deleteMany({ where: { taskId } });
    await tx.fillInstance.deleteMany({ where: { taskId } });
    await tx.slideAssignment.deleteMany({ where: { taskId } });
    await tx.reportTask.delete({ where: { id: taskId } });
  });
  await prisma.$disconnect();
}
