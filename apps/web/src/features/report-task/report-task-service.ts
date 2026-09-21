import { randomUUID } from "node:crypto";

import { Prisma, prisma } from "@report-platform/database";

import { currentActor, requireCollector, requireFiller } from "@/features/auth/authorization";

import { createTaskSchema, replaceAssignmentsSchema, startInstanceSchema, taskProgress } from "./task-policy";

export class ReportTaskError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "ReportTaskError";
  }
}

function notFound(): never {
  throw new ReportTaskError("NOT_FOUND", "任务或填报实例不存在", 404);
}

function conflict(message: string): never {
  throw new ReportTaskError("VERSION_CONFLICT", message, 409);
}

function assignmentKey(slideId: string, assigneeId: string) {
  return `${slideId}:${assigneeId}`;
}

function findCollectorTask(taskId: string, collectorId: string) {
  return prisma.reportTask.findFirst({
    where: { id: taskId, collectorId },
    include: {
      template: {
        select: {
          id: true,
          name: true,
          version: true,
          slides: {
            orderBy: { slideIndex: "asc" },
            select: {
              id: true,
              slideIndex: true,
              previewFileId: true,
              _count: { select: { placeholders: true } }
            }
          }
        }
      },
      assignments: {
        include: {
          assignee: { select: { id: true, username: true, name: true } },
          fillInstance: { select: { id: true, status: true, version: true } }
        }
      }
    }
  });
}

function taskDto(task: NonNullable<Awaited<ReturnType<typeof findCollectorTask>>>) {
  const assignments = task.assignments.map((assignment) => ({
    id: assignment.id,
    slideId: assignment.templateSlideId,
    assignee: assignment.assignee,
    fillInstance: assignment.fillInstance
  }));
  return {
    id: task.id,
    name: task.name,
    reportPeriod: task.reportPeriod,
    status: task.status,
    version: task.version,
    createdAt: task.createdAt.toISOString(),
    template: {
      id: task.template.id,
      name: task.template.name,
      version: task.template.version
    },
    progress: taskProgress(assignments.map((assignment) => assignment.fillInstance?.status ?? "NOT_STARTED")),
    slides: task.template.slides.map((slide) => {
      const slideAssignments = assignments.filter((assignment) => assignment.slideId === slide.id);
      return {
        id: slide.id,
        slideIndex: slide.slideIndex,
        placeholderCount: slide._count.placeholders,
        previewUrl: slide.previewFileId
          ? `/api/templates/${task.templateId}/slides/${slide.slideIndex}/preview`
          : null,
        assignments: slideAssignments,
        progress: taskProgress(slideAssignments.map((assignment) => assignment.fillInstance?.status ?? "NOT_STARTED"))
      };
    })
  };
}

export async function createReportTask(input: unknown) {
  const actor = await requireCollector();
  const parsed = createTaskSchema.parse(input);
  const taskId = await prisma.$transaction(async (tx) => {
    const template = await tx.reportTemplate.findFirst({
      where: { id: parsed.templateId, createdById: actor.id, status: "READY" },
      select: { id: true, slides: { select: { id: true }, take: 1 } }
    });
    if (!template || template.slides.length === 0) {
      throw new ReportTaskError("INVALID_TEMPLATE", "只能使用自己已解析完成的模板创建任务", 400);
    }
    const task = await tx.reportTask.create({
      data: {
        name: parsed.name,
        templateId: template.id,
        reportPeriod: parsed.reportPeriod,
        collectorId: actor.id
      }
    });
    await tx.operationLog.create({
      data: {
        actorId: actor.id,
        action: "REPORT_TASK_CREATED",
        resourceType: "ReportTask",
        resourceId: task.id,
        taskId: task.id,
        correlationId: randomUUID(),
        afterJson: { name: task.name, templateId: task.templateId, reportPeriod: task.reportPeriod }
      }
    });
    return task.id;
  });
  return getCollectorReportTask(taskId);
}

export async function listCollectorReportTasks() {
  const actor = await requireCollector();
  const tasks = await prisma.reportTask.findMany({
    where: { collectorId: actor.id },
    orderBy: { createdAt: "desc" },
    include: {
      template: { select: { name: true, version: true } },
      fillInstances: { select: { status: true } }
    }
  });
  return tasks.map((task) => ({
    id: task.id,
    name: task.name,
    reportPeriod: task.reportPeriod,
    status: task.status,
    version: task.version,
    template: task.template,
    progress: taskProgress(task.fillInstances.map((instance) => instance.status)),
    createdAt: task.createdAt.toISOString()
  }));
}

export async function getCollectorReportTask(taskId: string) {
  const actor = await requireCollector();
  const task = await findCollectorTask(taskId, actor.id);
  if (!task) return notFound();
  return taskDto(task);
}

export async function listAssignableFillers(existingAssigneeIds: string[] = []) {
  await requireCollector();
  return prisma.user.findMany({
    where: { OR: [
      { status: "ACTIVE", roles: { some: { role: { code: "FILLER" } } } },
      { id: { in: existingAssigneeIds } }
    ] },
    orderBy: { username: "asc" },
    select: { id: true, username: true, name: true, status: true }
  });
}

export async function listReadyOwnedTemplates() {
  const actor = await requireCollector();
  return prisma.reportTemplate.findMany({
    where: { createdById: actor.id, status: "READY" },
    orderBy: [{ name: "asc" }, { version: "desc" }],
    select: { id: true, name: true, version: true, _count: { select: { slides: true } } }
  });
}

export async function replaceTaskAssignments(taskId: string, input: unknown) {
  const actor = await requireCollector();
  const parsed = replaceAssignmentsSchema.parse(input);
  try {
    await prisma.$transaction(async (tx) => {
      const task = await tx.reportTask.findFirst({
        where: { id: taskId, collectorId: actor.id },
        include: {
          template: { select: { slides: { select: { id: true } } } },
          assignments: {
            include: {
              fillInstance: {
                select: {
                  id: true,
                  status: true,
                  _count: { select: { bindings: true, submittedValues: true } }
                }
              }
            }
          }
        }
      });
      if (!task) return notFound();
      if (task.version !== parsed.expectedVersion) conflict("任务已被其他用户更新，请刷新后重试");
      if (task.status !== "DRAFT" && task.status !== "FILLING") {
        throw new ReportTaskError("INVALID_STATE_TRANSITION", "当前任务状态不可修改分配", 409);
      }
      if (task.status === "FILLING" && parsed.assignments.length === 0) {
        throw new ReportTaskError("INVALID_STATE_TRANSITION", "进行中的任务至少保留一条分配", 409);
      }
      const slideIds = new Set(task.template.slides.map((slide) => slide.id));
      if (parsed.assignments.some((assignment) => !slideIds.has(assignment.slideId))) {
        throw new ReportTaskError("VALIDATION_ERROR", "分配页面不属于当前模板", 400);
      }
      const assigneeIds = [...new Set(parsed.assignments.map((assignment) => assignment.assigneeId))];
      const activeFillers = await tx.user.findMany({
        where: {
          id: { in: assigneeIds },
          status: "ACTIVE",
          roles: { some: { role: { code: "FILLER" } } }
        },
        select: { id: true }
      });
      if (activeFillers.length !== assigneeIds.length) {
        throw new ReportTaskError("VALIDATION_ERROR", "填报人不存在、被停用或缺少 Filler 角色", 400);
      }

      const existing = new Map(task.assignments.map((assignment) => [
        assignmentKey(assignment.templateSlideId, assignment.assigneeId), assignment
      ]));
      const desired = new Map(parsed.assignments.map((assignment) => [
        assignmentKey(assignment.slideId, assignment.assigneeId), assignment
      ]));
      const removals = [...existing].filter(([key]) => !desired.has(key));
      const additions = [...desired].filter(([key]) => !existing.has(key));
      if (removals.length === 0 && additions.length === 0) return;

      for (const [, assignment] of removals) {
        const instance = assignment.fillInstance;
        if (!instance || instance.status !== "NOT_STARTED" ||
            instance._count.bindings !== 0 || instance._count.submittedValues !== 0) {
          throw new ReportTaskError("INVALID_STATE_TRANSITION", "已有填报痕迹的分配不可撤销", 409);
        }
      }

      const updated = await tx.reportTask.updateMany({
        where: { id: task.id, version: parsed.expectedVersion },
        data: { version: { increment: 1 }, status: parsed.assignments.length ? "FILLING" : "DRAFT" }
      });
      if (updated.count !== 1) conflict("任务已被其他用户更新，请刷新后重试");

      for (const [, assignment] of removals) {
        await tx.fillInstance.delete({ where: { assignmentId: assignment.id } });
        await tx.slideAssignment.delete({ where: { id: assignment.id } });
      }
      for (const [, assignment] of additions) {
        await tx.slideAssignment.create({
          data: {
            taskId: task.id,
            templateSlideId: assignment.slideId,
            assigneeId: assignment.assigneeId,
            createdById: actor.id,
            fillInstance: {
              create: {
                taskId: task.id,
                templateSlideId: assignment.slideId,
                assigneeId: assignment.assigneeId
              }
            }
          }
        });
      }
      await tx.operationLog.create({
        data: {
          actorId: actor.id,
          action: "TASK_ASSIGNMENTS_REPLACED",
          resourceType: "ReportTask",
          resourceId: task.id,
          taskId: task.id,
          correlationId: randomUUID(),
          metadataJson: { added: additions.length, removed: removals.length }
        }
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2034" || error.code === "P2002")) {
      conflict("任务分配发生并发冲突，请刷新后重试");
    }
    throw error;
  }
  return getCollectorReportTask(taskId);
}

export async function listMyFillInstances() {
  const actor = await requireFiller();
  const instances = await prisma.fillInstance.findMany({
    where: { assigneeId: actor.id },
    orderBy: { createdAt: "desc" },
    include: {
      task: { select: { id: true, name: true, reportPeriod: true, status: true } },
      templateSlide: { select: { slideIndex: true, templateId: true, _count: { select: { placeholders: true } } } }
    }
  });
  return instances.map((instance) => ({
    id: instance.id,
    status: instance.status,
    version: instance.version,
    task: instance.task,
    slideIndex: instance.templateSlide.slideIndex,
    placeholderCount: instance.templateSlide._count.placeholders,
    previewUrl: `/api/templates/${instance.templateSlide.templateId}/slides/${instance.templateSlide.slideIndex}/preview`
  }));
}

export async function getFillInstance(instanceId: string) {
  const actor = await currentActor();
  const allowedRelations: Prisma.FillInstanceWhereInput[] = [];
  if (actor.roles.has("FILLER")) allowedRelations.push({ assigneeId: actor.id });
  if (actor.roles.has("COLLECTOR")) allowedRelations.push({ task: { collectorId: actor.id } });
  if (allowedRelations.length === 0) return notFound();
  const instance = await prisma.fillInstance.findFirst({
    where: {
      id: instanceId,
      OR: allowedRelations
    },
    include: {
      assignee: { select: { id: true, username: true, name: true } },
      task: { select: { id: true, name: true, reportPeriod: true, status: true, collectorId: true } },
      templateSlide: {
        select: {
          slideIndex: true,
          templateId: true,
          widthEmu: true,
          heightEmu: true,
          placeholders: {
            orderBy: [{ key: "asc" }, { occurrenceIndex: "asc" }],
            select: {
              id: true, key: true, occurrenceIndex: true, originalText: true,
              xEmu: true, yEmu: true, widthEmu: true, heightEmu: true
            }
          }
        }
      },
      bindings: {
        select: {
          placeholderId: true, sourceType: true, manualValue: true,
          metricDefinitionId: true, metricPeriod: true, sourceSnapshotJson: true, version: true
        }
      }
    }
  });
  if (!instance) return notFound();
  return {
    id: instance.id,
    status: instance.status,
    version: instance.version,
    assignee: instance.assignee,
    task: { id: instance.task.id, name: instance.task.name, reportPeriod: instance.task.reportPeriod, status: instance.task.status },
    slideIndex: instance.templateSlide.slideIndex,
    placeholders: instance.templateSlide.placeholders.map((placeholder) => ({
      id: placeholder.id,
      key: placeholder.key,
      occurrenceIndex: placeholder.occurrenceIndex,
      originalText: placeholder.originalText,
      geometry: {
        left: Number(placeholder.xEmu) / Number(instance.templateSlide.widthEmu) * 100,
        top: Number(placeholder.yEmu) / Number(instance.templateSlide.heightEmu) * 100,
        width: Number(placeholder.widthEmu) / Number(instance.templateSlide.widthEmu) * 100,
        height: Number(placeholder.heightEmu) / Number(instance.templateSlide.heightEmu) * 100
      }
    })),
    bindings: instance.bindings,
    previewUrl: `/api/templates/${instance.templateSlide.templateId}/slides/${instance.templateSlide.slideIndex}/preview`,
    editable: actor.roles.has("FILLER") && instance.assigneeId === actor.id
  };
}

export async function startFillInstance(instanceId: string, input: unknown) {
  const actor = await requireFiller();
  const parsed = startInstanceSchema.parse(input);
  await prisma.$transaction(async (tx) => {
    const instance = await tx.fillInstance.findFirst({
      where: { id: instanceId, assigneeId: actor.id },
      select: { id: true, taskId: true, status: true, version: true, task: { select: { status: true } } }
    });
    if (!instance) return notFound();
    if (instance.version !== parsed.expectedVersion) conflict("填报实例已更新，请刷新后重试");
    if (instance.task.status !== "FILLING" ||
        (instance.status !== "NOT_STARTED" && instance.status !== "RETURNED")) {
      throw new ReportTaskError("INVALID_STATE_TRANSITION", "当前填报实例不能开始填报", 409);
    }
    const result = await tx.fillInstance.updateMany({
      where: { id: instance.id, assigneeId: actor.id, version: parsed.expectedVersion, status: instance.status },
      data: { status: "IN_PROGRESS", version: { increment: 1 } }
    });
    if (result.count !== 1) conflict("填报实例已更新，请刷新后重试");
    await tx.operationLog.create({
      data: {
        actorId: actor.id,
        action: "FILL_INSTANCE_STARTED",
        resourceType: "FillInstance",
        resourceId: instance.id,
        taskId: instance.taskId,
        correlationId: randomUUID()
      }
    });
  });
  return getFillInstance(instanceId);
}
