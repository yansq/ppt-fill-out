import { createHash, randomUUID } from "node:crypto";

import { Prisma, prisma } from "@report-platform/database";

import { requireCollector } from "@/features/auth/authorization";
import { removeStoredFile } from "@/features/template/storage";
import { generateReport, type PptGenerateResponse } from "@/features/template/ppt-service-client";

import { exportSchema, generateSchema, missingFinalValues } from "./generation-policy";

export class GenerationError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number,
    public readonly details?: unknown) {
    super(message);
    this.name = "GenerationError";
  }
}

async function ownedTask(taskId: string, collectorId: string) {
  const task = await prisma.reportTask.findFirst({
    where: { id: taskId, collectorId },
    select: { id: true, status: true, version: true, name: true, template: {
      select: {
        sourceFile: { select: { storagePath: true, sha256: true } },
        slides: { orderBy: { slideIndex: "asc" }, select: {
          slideIndex: true,
          placeholders: { select: { id: true, key: true, occurrenceIndex: true } }
        } }
      }
    } }
  });
  if (!task) throw new GenerationError("NOT_FOUND", "报告任务不存在", 404);
  return task;
}

function artifactDto(file: {
  id: string; type: string; status: string; createdAt: Date;
  valuesSnapshotJson: Prisma.JsonValue;
  storedFile: { id: string; sha256: string; sizeBytes: bigint; mimeType: string } | null;
}) {
  const snapshot = file.valuesSnapshotJson as { generationId?: string; slideIndex?: number; warnings?: string[] };
  return {
    id: file.id, type: file.type, status: file.status,
    generationId: snapshot.generationId ?? null,
    slideIndex: snapshot.slideIndex ?? null,
    warnings: snapshot.warnings ?? [],
    createdAt: file.createdAt.toISOString(),
    fileId: file.storedFile?.id ?? null,
    sha256: file.storedFile?.sha256 ?? null,
    sizeBytes: file.storedFile ? Number(file.storedFile.sizeBytes) : null,
    previewUrl: file.type === "PNG" && file.storedFile ? `/api/files/${file.storedFile.id}` : null
  };
}

export async function listGeneratedFiles(taskId: string) {
  const actor = await requireCollector();
  const task = await ownedTask(taskId, actor.id);
  const files = await prisma.generatedFile.findMany({
    where: { taskId, status: "COMPLETED" },
    include: { storedFile: { select: { id: true, sha256: true, sizeBytes: true, mimeType: true } } },
    orderBy: { createdAt: "desc" }
  });
  return { task: { id: task.id, status: task.status, version: task.version }, files: files.map(artifactDto) };
}

export async function generateTaskReport(taskId: string, input: unknown) {
  const actor = await requireCollector();
  const parsed = generateSchema.parse(input);
  const existing = await prisma.generatedFile.findUnique({ where: { idempotencyKey: parsed.idempotencyKey } });
  if (existing) {
    if (existing.taskId !== taskId || existing.createdById !== actor.id) {
      throw new GenerationError("IDEMPOTENCY_CONFLICT", "该请求标识已用于其他任务", 409);
    }
    if (existing.status === "COMPLETED") return listGeneratedFiles(taskId);
    throw new GenerationError("GENERATION_IN_PROGRESS", "该请求正在生成或曾失败，请使用新请求标识重试", 409);
  }

  const task = await ownedTask(taskId, actor.id);
  if (task.version !== parsed.expectedVersion) {
    throw new GenerationError("VERSION_CONFLICT", "任务已更新，请刷新后重试", 409);
  }
  if (task.status !== "COMPLETED" && task.status !== "EXPORTED") {
    throw new GenerationError("INVALID_STATE_TRANSITION", "请先完成所有审核", 409);
  }
  const placeholders = task.template.slides.flatMap((slide) => slide.placeholders.map((placeholder) => ({
    ...placeholder, slideIndex: slide.slideIndex
  })));
  const finals = await prisma.finalValue.findMany({
    where: { taskId, placeholderId: { in: placeholders.map((placeholder) => placeholder.id) } },
    select: { id: true, placeholderId: true, valueText: true, version: true, resolutionType: true, selectedSubmittedValueId: true }
  });
  const missing = missingFinalValues(placeholders, new Set(finals.map((value) => value.placeholderId)));
  if (missing.length) {
    throw new GenerationError("MISSING_FINAL_VALUES", "模板仍有未确定最终值的占位符", 409,
      missing.map(({ key, slideIndex, occurrenceIndex }) => ({ key, slideIndex, occurrenceIndex })));
  }
  const finalByPlaceholder = new Map(finals.map((value) => [value.placeholderId, value]));
  const values = placeholders.map((placeholder) => {
    const final = finalByPlaceholder.get(placeholder.id)!;
    return {
      slideIndex: placeholder.slideIndex,
      key: placeholder.key,
      occurrenceIndex: placeholder.occurrenceIndex,
      valueText: final.valueText,
      finalValueId: final.id,
      finalValueVersion: final.version,
      resolutionType: final.resolutionType,
      selectedSubmittedValueId: final.selectedSubmittedValueId
    };
  });
  const generationId = randomUUID();
  const snapshot = {
    generationId,
    taskVersion: task.version,
    templateSha256: task.template.sourceFile.sha256,
    values
  };
  const snapshotHash = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  let pending;
  try {
    pending = await prisma.$transaction(async (tx) => {
      const fresh = await tx.reportTask.findFirst({ where: { id: taskId, collectorId: actor.id }, select: { version: true, status: true } });
      if (!fresh || fresh.version !== task.version || (fresh.status !== "COMPLETED" && fresh.status !== "EXPORTED")) {
        throw new GenerationError("VERSION_CONFLICT", "任务状态已变化，请刷新后重试", 409);
      }
      const currentFinals = await tx.finalValue.findMany({ where: { taskId }, select: { id: true, version: true } });
      if (currentFinals.length !== finals.length || currentFinals.some((value) =>
        !finals.some((original) => original.id === value.id && original.version === value.version))) {
        throw new GenerationError("VERSION_CONFLICT", "最终值已变化，请刷新后重试", 409);
      }
      const record = await tx.generatedFile.create({ data: {
        taskId, type: "PPTX", status: "PROCESSING", createdById: actor.id,
        idempotencyKey: parsed.idempotencyKey,
        valuesSnapshotJson: snapshot as Prisma.InputJsonValue
      } });
      await tx.operationLog.create({ data: {
        actorId: actor.id, action: "REPORT_GENERATION_STARTED", resourceType: "GeneratedFile", resourceId: record.id,
        taskId, correlationId: randomUUID(), metadataJson: { generationId, snapshotHash }
      } });
      return record;
    });
  } catch (error) {
    if (error instanceof GenerationError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new GenerationError("IDEMPOTENCY_CONFLICT", "该请求标识已被使用", 409);
    }
    throw error;
  }

  let result: PptGenerateResponse | undefined;
  try {
    result = await generateReport({
      relativePath: task.template.sourceFile.storagePath,
      sha256: task.template.sourceFile.sha256,
      generationId,
      values: values.map(({ slideIndex, key, occurrenceIndex, valueText }) => ({ slideIndex, key, occurrenceIndex, valueText }))
    });
    for (const file of result.files) {
      if (!file.relativePath.startsWith(`generated/${generationId}/`)) {
        throw new Error("PPT Service returned a file outside this generation");
      }
    }
    await prisma.$transaction(async (tx) => {
      for (const file of result!.files) {
        const stored = await tx.storedFile.create({ data: {
          category: "GENERATED", storagePath: file.relativePath,
          originalFilename: file.relativePath.split("/").at(-1)!,
          mimeType: file.mimeType, sizeBytes: BigInt(file.sizeBytes), sha256: file.sha256,
          createdById: actor.id
        } });
        const artifactSnapshot = { ...snapshot, snapshotHash, slideIndex: file.slideIndex, warnings: result!.warnings };
        if (file.type === "PPTX") {
          await tx.generatedFile.update({ where: { id: pending.id }, data: {
            status: "COMPLETED", storedFileId: stored.id,
            valuesSnapshotJson: artifactSnapshot as Prisma.InputJsonValue,
            completedAt: new Date()
          } });
        } else {
          await tx.generatedFile.create({ data: {
            taskId, type: file.type, status: "COMPLETED", storedFileId: stored.id,
            valuesSnapshotJson: artifactSnapshot as Prisma.InputJsonValue,
            idempotencyKey: `${parsed.idempotencyKey}:${file.type}:${file.slideIndex ?? "all"}`,
            createdById: actor.id, completedAt: new Date()
          } });
        }
      }
      await tx.operationLog.create({ data: {
        actorId: actor.id, action: "REPORT_GENERATED", resourceType: "GeneratedFile", resourceId: pending.id,
        taskId, correlationId: randomUUID(), metadataJson: {
          generationId, snapshotHash, pageCount: result!.pageCount, fileCount: result!.files.length,
          warnings: result!.warnings
        }
      } });
    });
    return listGeneratedFiles(taskId);
  } catch {
    if (result) await Promise.all(result.files.map((file) => removeStoredFile(file.relativePath).catch(() => undefined)));
    await prisma.generatedFile.update({ where: { id: pending.id }, data: { status: "FAILED", errorCode: "PPT_GENERATE_FAILED" } }).catch(() => undefined);
    throw new GenerationError("PPT_GENERATE_FAILED", "报告生成失败，请检查 PPT 服务并重试", 503);
  }
}

export async function prepareExport(taskId: string, input: unknown) {
  const actor = await requireCollector();
  const parsed = exportSchema.parse(input);
  await prisma.$transaction(async (tx) => {
    const task = await tx.reportTask.findFirst({ where: { id: taskId, collectorId: actor.id }, select: { id: true, status: true } });
    if (!task) throw new GenerationError("NOT_FOUND", "任务不存在", 404);
    if (task.status !== "COMPLETED" && task.status !== "EXPORTED") {
      throw new GenerationError("INVALID_STATE_TRANSITION", "任务尚未完成审核", 409);
    }
    const file = await tx.generatedFile.findFirst({
      where: { id: parsed.generatedFileId, taskId, status: "COMPLETED", type: { in: ["PPTX", "PDF"] } },
      include: { storedFile: { select: { id: true, sha256: true } } }
    });
    if (!file?.storedFile) throw new GenerationError("NOT_FOUND", "导出文件不存在", 404);
    if (task.status === "COMPLETED") await tx.reportTask.update({ where: { id: taskId }, data: { status: "EXPORTED", version: { increment: 1 } } });
    await tx.operationLog.create({ data: {
      actorId: actor.id, action: "REPORT_EXPORTED", resourceType: "GeneratedFile", resourceId: file.id,
      taskId, correlationId: randomUUID(), metadataJson: { type: file.type, sha256: file.storedFile.sha256 }
    } });
  });
  const file = await prisma.generatedFile.findUniqueOrThrow({
    where: { id: parsed.generatedFileId }, select: { storedFileId: true }
  });
  return { downloadUrl: `/api/files/${file.storedFileId}` };
}
