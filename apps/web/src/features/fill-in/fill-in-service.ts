import { randomUUID } from "node:crypto";

import { Prisma, prisma } from "@report-platform/database";

import { requireFiller } from "@/features/auth/authorization";
import { readMetricSnapshot } from "@/features/metric/metric-service";
import { getFillInstance, ReportTaskError } from "@/features/report-task/report-task-service";

import { saveBindingSchema, submitSchema } from "./fill-in-policy";

function conflict(): never {
  throw new ReportTaskError("VERSION_CONFLICT", "填报实例已更新，请刷新后重试", 409);
}

function notFound(): never {
  throw new ReportTaskError("NOT_FOUND", "填报实例或占位符不存在", 404);
}

export async function saveBinding(instanceId: string, placeholderId: string, input: unknown) {
  const actor = await requireFiller();
  const parsed = saveBindingSchema.parse(input);
  const authorized = await prisma.fillInstance.findFirst({
    where: { id: instanceId, assigneeId: actor.id },
    select: { id: true, templateSlideId: true, status: true, version: true, taskId: true }
  });
  if (!authorized) notFound();
  if (authorized.version !== parsed.expectedVersion) conflict();
  if (authorized.status !== "IN_PROGRESS") {
    throw new ReportTaskError("INVALID_STATE_TRANSITION", "当前填报实例不可编辑", 409);
  }
  const placeholder = await prisma.templatePlaceholder.findFirst({
    where: { id: placeholderId, slideId: authorized.templateSlideId }, select: { id: true }
  });
  if (!placeholder) notFound();

  const snapshot = parsed.sourceType === "DATABASE_METRIC"
    ? await readMetricSnapshot(parsed.metricDefinitionId, parsed.metricPeriod)
    : null;

  await prisma.$transaction(async (tx) => {
    const updated = await tx.fillInstance.updateMany({
      where: { id: instanceId, assigneeId: actor.id, status: "IN_PROGRESS", version: parsed.expectedVersion },
      data: { version: { increment: 1 } }
    });
    if (updated.count !== 1) conflict();
    await tx.placeholderBinding.upsert({
      where: { fillInstanceId_placeholderId: { fillInstanceId: instanceId, placeholderId } },
      create: {
        fillInstanceId: instanceId,
        placeholderId,
        sourceType: parsed.sourceType,
        metricDefinitionId: parsed.sourceType === "DATABASE_METRIC" ? parsed.metricDefinitionId : null,
        metricPeriod: parsed.sourceType === "DATABASE_METRIC" ? parsed.metricPeriod : null,
        manualValue: parsed.sourceType === "MANUAL_TEXT" ? parsed.manualValue : null,
        sourceSnapshotJson: snapshot ? snapshot as Prisma.InputJsonValue : undefined,
        updatedById: actor.id
      },
      update: {
        sourceType: parsed.sourceType,
        metricDefinitionId: parsed.sourceType === "DATABASE_METRIC" ? parsed.metricDefinitionId : null,
        metricPeriod: parsed.sourceType === "DATABASE_METRIC" ? parsed.metricPeriod : null,
        manualValue: parsed.sourceType === "MANUAL_TEXT" ? parsed.manualValue : null,
        sourceSnapshotJson: snapshot ? snapshot as Prisma.InputJsonValue : Prisma.DbNull,
        updatedById: actor.id,
        version: { increment: 1 }
      }
    });
    await tx.operationLog.create({
      data: {
        actorId: actor.id,
        action: "PLACEHOLDER_BINDING_SAVED",
        resourceType: "PlaceholderBinding",
        resourceId: placeholderId,
        taskId: authorized.taskId,
        correlationId: randomUUID(),
        metadataJson: { fillInstanceId: instanceId, sourceType: parsed.sourceType, period: parsed.sourceType === "DATABASE_METRIC" ? parsed.metricPeriod : null }
      }
    });
  });
  return getFillInstance(instanceId);
}

export async function submitFillInstance(instanceId: string, input: unknown) {
  const actor = await requireFiller();
  const parsed = submitSchema.parse(input);
  await prisma.$transaction(async (tx) => {
    const instance = await tx.fillInstance.findFirst({
      where: { id: instanceId, assigneeId: actor.id },
      include: {
        templateSlide: { select: { placeholders: { select: { id: true } } } },
        bindings: true,
        submittedValues: { select: { submissionRevision: true }, orderBy: { submissionRevision: "desc" }, take: 1 },
        task: { select: { status: true, reportPeriod: true } }
      }
    });
    if (!instance) notFound();
    if (instance.version !== parsed.expectedVersion) conflict();
    if (instance.status !== "IN_PROGRESS" || instance.task.status !== "FILLING") {
      throw new ReportTaskError("INVALID_STATE_TRANSITION", "当前状态不可提交", 409);
    }
    const bound = new Map(instance.bindings.map((binding) => [binding.placeholderId, binding]));
    if (instance.templateSlide.placeholders.some((placeholder) => !bound.has(placeholder.id))) {
      throw new ReportTaskError("INCOMPLETE_BINDINGS", "请先填写本页全部占位符", 400);
    }
    const updated = await tx.fillInstance.updateMany({
      where: { id: instanceId, assigneeId: actor.id, status: "IN_PROGRESS", version: parsed.expectedVersion },
      data: { status: "SUBMITTED", submittedAt: new Date(), version: { increment: 1 } }
    });
    if (updated.count !== 1) conflict();
    const submissionRevision = (instance.submittedValues[0]?.submissionRevision ?? 0) + 1;
    for (const placeholder of instance.templateSlide.placeholders) {
      const binding = bound.get(placeholder.id)!;
      const source = binding.sourceSnapshotJson as { valueText?: string; period?: string } | null;
      const valueText = binding.sourceType === "MANUAL_TEXT" ? binding.manualValue : source?.valueText;
      if (!valueText) throw new ReportTaskError("INCOMPLETE_BINDINGS", "占位符缺少有效值", 400);
      await tx.submittedValue.create({
        data: {
          fillInstanceId: instance.id,
          placeholderId: placeholder.id,
          valueText,
          sourceType: binding.sourceType,
          sourceSnapshotJson: binding.sourceSnapshotJson ?? undefined,
          bindingSnapshotJson: {
            bindingId: binding.id,
            bindingVersion: binding.version,
            sourceType: binding.sourceType,
            metricDefinitionId: binding.metricDefinitionId,
            metricPeriod: binding.metricPeriod,
            reportPeriod: instance.task.reportPeriod
          },
          submittedById: actor.id,
          submissionRevision
        }
      });
    }
    await tx.operationLog.create({
      data: {
        actorId: actor.id,
        action: "FILL_INSTANCE_SUBMITTED",
        resourceType: "FillInstance",
        resourceId: instance.id,
        taskId: instance.taskId,
        correlationId: randomUUID(),
        metadataJson: { submissionRevision, placeholderCount: instance.templateSlide.placeholders.length }
      }
    });
    const remaining = await tx.fillInstance.count({
      where: { taskId: instance.taskId, status: { notIn: ["SUBMITTED", "REVIEWED"] } }
    });
    if (remaining === 0) await tx.reportTask.updateMany({
      where: { id: instance.taskId, status: "FILLING" }, data: { status: "REVIEWING", version: { increment: 1 } }
    });
  });
  return getFillInstance(instanceId);
}
