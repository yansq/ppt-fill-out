import { randomUUID } from "node:crypto";

import { Prisma, prisma } from "@report-platform/database";

import { requireCollector } from "@/features/auth/authorization";
import { ReportTaskError } from "@/features/report-task/report-task-service";

import { completeSchema, decisionSchema, returnSchema, submissionStatus } from "./review-policy";

function conflict(): never {
  throw new ReportTaskError("VERSION_CONFLICT", "审核结果已更新，请刷新后重试", 409);
}

function invalid(message: string): never {
  throw new ReportTaskError("INVALID_STATE_TRANSITION", message, 409);
}

async function ownedTask(taskId: string, collectorId: string, tx: Prisma.TransactionClient = prisma) {
  const task = await tx.reportTask.findFirst({ where: { id: taskId, collectorId }, select: { id: true, templateId: true, status: true, version: true } });
  if (!task) throw new ReportTaskError("NOT_FOUND", "任务不存在", 404);
  return task;
}

export async function getReview(taskId: string) {
  const actor = await requireCollector();
  const task = await ownedTask(taskId, actor.id);
  const [slides, instances, finals] = await Promise.all([
    prisma.templateSlide.findMany({
      where: { templateId: task.templateId, assignments: { some: { taskId } } },
      orderBy: { slideIndex: "asc" },
      select: { id: true, slideIndex: true, placeholders: { orderBy: [{ key: "asc" }, { occurrenceIndex: "asc" }], select: { id: true, key: true, occurrenceIndex: true } } }
    }),
    prisma.fillInstance.findMany({
      where: { taskId },
      select: {
        id: true, templateSlideId: true, status: true, version: true,
        assignee: { select: { username: true, name: true } },
        submittedValues: { orderBy: [{ submissionRevision: "desc" }, { submittedAt: "desc" }], select: { id: true, placeholderId: true, valueText: true, submissionRevision: true, sourceType: true, submittedAt: true } }
      }
    }),
    prisma.finalValue.findMany({ where: { taskId }, select: { id: true, placeholderId: true, valueText: true, resolutionType: true, selectedSubmittedValueId: true, version: true, decidedAt: true } })
  ]);
  const finalByPlaceholder = new Map(finals.map((value) => [value.placeholderId, value]));
  return {
    task: { id: task.id, status: task.status, version: task.version },
    slides: slides.map((slide) => {
      const slideInstances = instances.filter((instance) => instance.templateSlideId === slide.id);
      return {
        id: slide.id, slideIndex: slide.slideIndex,
        instances: slideInstances.map((instance) => ({ id: instance.id, status: instance.status, version: instance.version, assignee: instance.assignee })),
        placeholders: slide.placeholders.map((placeholder) => {
          const submissions = slideInstances.flatMap((instance) => {
            if (instance.status !== "SUBMITTED" && instance.status !== "REVIEWED") return [];
            const latest = instance.submittedValues.find((value) => value.placeholderId === placeholder.id);
            return latest ? [{ ...latest, fillInstanceId: instance.id, assignee: instance.assignee }] : [];
          });
          return {
            ...placeholder,
            status: submissionStatus(submissions.map((value) => value.valueText), slideInstances.length),
            submissions,
            finalValue: finalByPlaceholder.get(placeholder.id) ?? null
          };
        })
      };
    })
  };
}

export async function decideFinalValue(taskId: string, placeholderId: string, input: unknown) {
  const actor = await requireCollector();
  const decision = decisionSchema.parse(input);
  await prisma.$transaction(async (tx) => {
    const task = await ownedTask(taskId, actor.id, tx);
    if (task.version !== decision.expectedVersion) conflict();
    if (task.status !== "REVIEWING") invalid("任务当前不可审核");
    const placeholder = await tx.templatePlaceholder.findFirst({
      where: { id: placeholderId, slide: { templateId: task.templateId, assignments: { some: { taskId } } } },
      select: { id: true, slideId: true }
    });
    if (!placeholder) throw new ReportTaskError("NOT_FOUND", "占位符不属于该任务的已分配页面", 404);
    let selected = null;
    if (decision.resolutionType === "SELECTED_SUBMISSION") {
      selected = await tx.submittedValue.findFirst({
        where: { id: decision.selectedSubmittedValueId, placeholderId, fillInstance: { taskId, templateSlideId: placeholder.slideId, status: "SUBMITTED" } },
        include: { fillInstance: { select: { id: true } } }
      });
      if (!selected) throw new ReportTaskError("VALIDATION_ERROR", "所选提交值不属于当前待审核页面", 400);
      const latest = await tx.submittedValue.findFirst({
        where: { fillInstanceId: selected.fillInstance.id, placeholderId },
        orderBy: { submissionRevision: "desc" }, select: { id: true }
      });
      if (latest?.id !== selected.id) throw new ReportTaskError("VALIDATION_ERROR", "不能采用旧版提交值", 400);
    }
    const changed = await tx.reportTask.updateMany({
      where: { id: taskId, collectorId: actor.id, status: "REVIEWING", version: decision.expectedVersion },
      data: { version: { increment: 1 } }
    });
    if (changed.count !== 1) conflict();
    const previous = await tx.finalValue.findUnique({ where: { taskId_placeholderId: { taskId, placeholderId } } });
    const valueText = selected?.valueText ?? (decision.resolutionType === "MANUAL" ? decision.valueText : "");
    const next = await tx.finalValue.upsert({
      where: { taskId_placeholderId: { taskId, placeholderId } },
      create: {
        taskId, placeholderId, valueText, resolutionType: decision.resolutionType,
        selectedSubmittedValueId: selected?.id, sourceSnapshotJson: selected?.sourceSnapshotJson ?? undefined, decidedById: actor.id
      },
      update: {
        valueText, resolutionType: decision.resolutionType, selectedSubmittedValueId: selected?.id,
        sourceSnapshotJson: selected?.sourceSnapshotJson ?? Prisma.DbNull,
        decidedById: actor.id, decidedAt: new Date(), version: { increment: 1 }
      }
    });
    await tx.operationLog.create({ data: {
      actorId: actor.id, action: "FINAL_VALUE_DECIDED", resourceType: "FinalValue", resourceId: next.id,
      taskId, correlationId: randomUUID(),
      beforeJson: previous ? { valueText: previous.valueText, resolutionType: previous.resolutionType, selectedSubmittedValueId: previous.selectedSubmittedValueId } : undefined,
      afterJson: { valueText, resolutionType: decision.resolutionType, selectedSubmittedValueId: selected?.id ?? null }
    } });
  });
  return getReview(taskId);
}

export async function returnFillInstance(taskId: string, instanceId: string, input: unknown) {
  const actor = await requireCollector();
  const parsed = returnSchema.parse(input);
  await prisma.$transaction(async (tx) => {
    const task = await ownedTask(taskId, actor.id, tx);
    if (task.version !== parsed.expectedVersion) conflict();
    if (task.status !== "REVIEWING") invalid("只有审核中的任务可以退回");
    const instance = await tx.fillInstance.findFirst({ where: { id: instanceId, taskId, status: "SUBMITTED" }, select: { id: true, templateSlideId: true, version: true } });
    if (!instance) invalid("只能退回已提交的填报实例");
    const changed = await tx.reportTask.updateMany({ where: { id: taskId, status: "REVIEWING", version: parsed.expectedVersion }, data: { status: "FILLING", version: { increment: 1 } } });
    if (changed.count !== 1) conflict();
    await tx.fillInstance.update({ where: { id: instanceId }, data: { status: "RETURNED", reviewedAt: new Date(), version: { increment: 1 } } });
    const placeholders = await tx.templatePlaceholder.findMany({ where: { slideId: instance.templateSlideId }, select: { id: true } });
    const invalidated = await tx.finalValue.findMany({ where: { taskId, placeholderId: { in: placeholders.map((value) => value.id) } }, select: { id: true, placeholderId: true, valueText: true } });
    await tx.finalValue.deleteMany({ where: { taskId, placeholderId: { in: placeholders.map((value) => value.id) } } });
    await tx.operationLog.create({ data: {
      actorId: actor.id, action: "FILL_INSTANCE_RETURNED", resourceType: "FillInstance", resourceId: instanceId,
      taskId, correlationId: randomUUID(), metadataJson: { reason: parsed.reason, invalidatedFinalValues: invalidated }
    } });
  });
  return getReview(taskId);
}

export async function completeReview(taskId: string, input: unknown) {
  const actor = await requireCollector();
  const parsed = completeSchema.parse(input);
  await prisma.$transaction(async (tx) => {
    const task = await ownedTask(taskId, actor.id, tx);
    if (task.version !== parsed.expectedVersion) conflict();
    if (task.status !== "REVIEWING") invalid("任务当前不可完成审核");
    const instances = await tx.fillInstance.findMany({ where: { taskId }, select: { status: true, templateSlideId: true } });
    if (!instances.length || instances.some((instance) => instance.status !== "SUBMITTED" && instance.status !== "REVIEWED")) invalid("所有填报实例必须先提交");
    const slideIds = [...new Set(instances.map((instance) => instance.templateSlideId))];
    const required = await tx.templatePlaceholder.findMany({ where: { slideId: { in: slideIds } }, select: { id: true } });
    const finalCount = await tx.finalValue.count({ where: { taskId, placeholderId: { in: required.map((value) => value.id) } } });
    if (finalCount !== required.length) invalid("还有占位符未确定最终值");
    const changed = await tx.reportTask.updateMany({ where: { id: taskId, status: "REVIEWING", version: parsed.expectedVersion }, data: { status: "COMPLETED", version: { increment: 1 } } });
    if (changed.count !== 1) conflict();
    await tx.fillInstance.updateMany({ where: { taskId, status: "SUBMITTED" }, data: { status: "REVIEWED", reviewedAt: new Date(), version: { increment: 1 } } });
    await tx.operationLog.create({ data: { actorId: actor.id, action: "REVIEW_COMPLETED", resourceType: "ReportTask", resourceId: taskId, taskId, correlationId: randomUUID(), metadataJson: { finalCount } } });
  });
  return getReview(taskId);
}
