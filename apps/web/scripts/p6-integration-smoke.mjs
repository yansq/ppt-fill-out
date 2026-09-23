import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const databaseRequire = createRequire(new URL("../../../packages/database/package.json", import.meta.url));
const { PrismaClient } = databaseRequire("@prisma/client");
const prisma = new PrismaClient();
const baseUrl = process.env.P6_SMOKE_BASE_URL;
if (!baseUrl || !process.env.P6_SMOKE_ADMIN_PASSWORD || !process.env.P6_SMOKE_FILLER_PASSWORD || !process.env.STORAGE_ROOT) {
  throw new Error("Set P6_SMOKE_BASE_URL, admin/filler passwords and STORAGE_ROOT");
}

async function login(employeeNumber, password) {
  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`);
  const { csrfToken } = await csrfResponse.json();
  const csrfCookies = csrfResponse.headers.getSetCookie().map((value) => value.split(";")[0]);
  const response = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: "POST", redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: csrfCookies.join("; ") },
    body: new URLSearchParams({ csrfToken, employeeNumber, password, callbackUrl: baseUrl })
  });
  assert.equal(response.status, 302, `login failed for ${employeeNumber}`);
  const cookie = response.headers.getSetCookie().map((value) => value.split(";")[0]).find((value) => value.includes("authjs.session-token="));
  assert.ok(cookie);
  return cookie;
}

async function api(cookie, method, pathname, body, status) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: { Cookie: cookie, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json();
  assert.equal(response.status, status, `${method} ${pathname}: ${JSON.stringify(payload)}`);
  return payload;
}

let taskId;
try {
  const authUsers = await prisma.user.findMany({ where: { username: { in: ["admin", "aaa"] } } });
  const employeeNumber = (username) => authUsers.find((user) => user.username === username)?.employeeNumber;
  assert.ok(employeeNumber("admin") && employeeNumber("aaa"), "admin/aaa users must exist");
  const admin = await login(employeeNumber("admin"), process.env.P6_SMOKE_ADMIN_PASSWORD);
  const filler = await login(employeeNumber("aaa"), process.env.P6_SMOKE_FILLER_PASSWORD);
  const template = await prisma.reportTemplate.findFirst({
    where: { createdBy: { username: "admin" }, status: "READY" },
    include: { sourceFile: true, slides: { include: { placeholders: true }, orderBy: { slideIndex: "asc" } } }
  });
  assert.ok(template);
  const activeSlides = template.slides.filter((slide) => slide.placeholders.length > 0);
  assert.ok(activeSlides.length > 0);
  const fillerUser = await prisma.user.findUniqueOrThrow({ where: { username: "aaa" } });
  const created = await api(admin, "POST", "/api/report-tasks", {
    name: `P6 冒烟 ${randomUUID()}`, templateId: template.id, reportPeriod: "2026-09"
  }, 201);
  taskId = created.task.id;
  await api(admin, "PUT", `/api/report-tasks/${taskId}/assignments`, {
    expectedVersion: created.task.version,
    assignments: activeSlides.map((slide) => ({ slideId: slide.id, assigneeId: fillerUser.id }))
  }, 200);
  const instances = await prisma.fillInstance.findMany({ where: { taskId } });
  assert.equal(instances.length, activeSlides.length);
  for (const instance of instances) {
    const slide = activeSlides.find((item) => item.id === instance.templateSlideId);
    let result = await api(filler, "POST", `/api/fill-instances/${instance.id}/start`, { expectedVersion: instance.version }, 200);
    for (const placeholder of slide.placeholders) {
      result = await api(filler, "PUT", `/api/fill-instances/${instance.id}/bindings/${placeholder.id}`, {
        expectedVersion: result.instance.version, sourceType: "MANUAL_TEXT", manualValue: `P6-${placeholder.key}-${placeholder.occurrenceIndex}`
      }, 200);
    }
    await api(filler, "POST", `/api/fill-instances/${instance.id}/submit`, { expectedVersion: result.instance.version }, 200);
  }
  let review = await api(admin, "GET", `/api/report-tasks/${taskId}/review`, undefined, 200);
  assert.equal(review.task.status, "REVIEWING");
  for (const placeholder of review.slides.flatMap((slide) => slide.placeholders)) {
    review = await api(admin, "PUT", `/api/report-tasks/${taskId}/final-values/${placeholder.id}`, {
      expectedVersion: review.task.version, resolutionType: "MANUAL", valueText: `最终-${placeholder.key}-${placeholder.occurrenceIndex}`
    }, 200);
  }
  review = await api(admin, "POST", `/api/report-tasks/${taskId}/review`, { expectedVersion: review.task.version }, 200);
  assert.equal(review.task.status, "COMPLETED");
  await api(filler, "POST", `/api/report-tasks/${taskId}/generate`, { expectedVersion: review.task.version, idempotencyKey: randomUUID() }, 403);
  const idempotencyKey = randomUUID();
  await api(admin, "POST", `/api/report-tasks/${taskId}/generate`, { expectedVersion: review.task.version - 1, idempotencyKey: randomUUID() }, 409);
  const generated = await api(admin, "POST", `/api/report-tasks/${taskId}/generate`, { expectedVersion: review.task.version, idempotencyKey }, 200);
  const generationId = generated.files[0]?.generationId;
  const artifacts = generated.files.filter((file) => file.generationId === generationId);
  assert.equal(artifacts.length, template.slides.length + 2);
  const pptx = artifacts.find((file) => file.type === "PPTX");
  const pdf = artifacts.find((file) => file.type === "PDF");
  const firstPage = artifacts.find((file) => file.type === "PNG" && file.slideIndex === 0);
  assert.ok(pptx && pdf && firstPage);
  const repeated = await api(admin, "POST", `/api/report-tasks/${taskId}/generate`, { expectedVersion: review.task.version, idempotencyKey }, 200);
  assert.equal(repeated.files.filter((file) => file.generationId === generationId).length, artifacts.length);
  await api(filler, "GET", `/api/files/${pptx.fileId}`, undefined, 403);
  for (const [file, magic] of [[pptx, "PK"], [pdf, "%PDF"]]) {
    const response = await fetch(`${baseUrl}/api/files/${file.fileId}`, { headers: { Cookie: admin } });
    assert.equal(response.status, 200);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.subarray(0, magic.length).toString(), magic);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), file.sha256);
  }
  const preview = await fetch(`${baseUrl}/api/files/${firstPage.fileId}`, { headers: { Cookie: admin } });
  assert.equal(preview.status, 200);
  assert.equal(Buffer.from(await preview.arrayBuffer()).subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const exported = await api(admin, "POST", `/api/report-tasks/${taskId}/exports`, { generatedFileId: pptx.id }, 200);
  assert.equal(exported.downloadUrl, `/api/files/${pptx.fileId}`);
  const task = await prisma.reportTask.findUniqueOrThrow({ where: { id: taskId } });
  assert.equal(task.status, "EXPORTED");
  const sourceBytes = await readFile(path.resolve(process.env.STORAGE_ROOT, template.sourceFile.storagePath));
  assert.equal(createHash("sha256").update(sourceBytes).digest("hex"), template.sourceFile.sha256);
  process.stdout.write(`P6 smoke: ${template.slides.length} pages, FinalValue snapshot, PPTX/PDF/PNG, idempotency, authorization and export audit passed.\n`);
} finally {
  if (taskId) {
    const files = await prisma.storedFile.findMany({ where: { generatedRecord: { taskId } }, select: { id: true, storagePath: true } });
    await prisma.$transaction(async (tx) => {
      const ids = (await tx.fillInstance.findMany({ where: { taskId }, select: { id: true } })).map((item) => item.id);
      await tx.generatedFile.deleteMany({ where: { taskId } });
      await tx.storedFile.deleteMany({ where: { id: { in: files.map((file) => file.id) } } });
      await tx.finalValue.deleteMany({ where: { taskId } });
      await tx.submittedValue.deleteMany({ where: { fillInstanceId: { in: ids } } });
      await tx.placeholderBinding.deleteMany({ where: { fillInstanceId: { in: ids } } });
      await tx.operationLog.deleteMany({ where: { taskId } });
      await tx.fillInstance.deleteMany({ where: { taskId } });
      await tx.slideAssignment.deleteMany({ where: { taskId } });
      await tx.reportTask.delete({ where: { id: taskId } });
    });
    for (const file of files) {
      if (file.storagePath.startsWith("generated/") && !file.storagePath.includes("..")) {
        await unlink(path.resolve(process.env.STORAGE_ROOT, file.storagePath)).catch(() => undefined);
      }
    }
  }
  await prisma.$disconnect();
}
