import { createHash, randomUUID } from "node:crypto";

import { Prisma, TemplateStatus, prisma } from "@report-platform/database";
import { z } from "zod";

import { currentActor, requireCollector } from "@/features/auth/authorization";

import {
  parseTemplate,
  renderStaticPreview,
  renderTemplate,
  type PptParseResponse,
  type PptRenderResponse
} from "./ppt-service-client";
import { validatePptxPackage } from "./pptx-validation";
import { readStoredFile, removeStoredFile, saveTemplateFile } from "./storage";

const templateNameSchema = z.string().trim().min(1).max(191);
const acceptedMimeTypes = new Set([
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/octet-stream",
  "application/zip"
]);

export class TemplateUploadError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "TemplateUploadError";
  }
}

export function maxUploadBytes() {
  const parsed = Number.parseInt(process.env.MAX_UPLOAD_SIZE_MB ?? "50", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new TemplateUploadError("CONFIGURATION_ERROR", "MAX_UPLOAD_SIZE_MB 配置无效", 500);
  }
  return parsed * 1024 * 1024;
}

function visibleTemplateWhere(actor: Awaited<ReturnType<typeof currentActor>>): Prisma.ReportTemplateWhereInput {
  const accessible: Prisma.ReportTemplateWhereInput[] = [];
  if (actor.roles.has("COLLECTOR")) {
    accessible.push({ createdById: actor.id });
    accessible.push({ tasks: { some: { collectorId: actor.id } } });
  }
  if (actor.roles.has("FILLER")) {
    accessible.push({ tasks: { some: { assignments: { some: { assigneeId: actor.id } } } } });
  }
  return accessible.length ? { OR: accessible } : { id: { in: [] } };
}

function templateDto(template: NonNullable<Awaited<ReturnType<typeof findTemplate>>>) {
  return {
    id: template.id,
    createdById: template.createdById,
    name: template.name,
    version: template.version,
    status: template.status,
    sha256: template.sha256,
    parserVersion: template.parserVersion,
    originalFilename: template.sourceFile.originalFilename,
    sizeBytes: template.sourceFile.sizeBytes.toString(),
    createdAt: template.createdAt.toISOString(),
    slides: template.slides.map((slide) => ({
      id: slide.id,
      slideIndex: slide.slideIndex,
      widthEmu: slide.widthEmu.toString(),
      heightEmu: slide.heightEmu.toString(),
      placeholders: slide.placeholders.map((placeholder) => ({
        id: placeholder.id,
        key: placeholder.key,
        occurrenceIndex: placeholder.occurrenceIndex,
        shapeId: placeholder.shapeId,
        shapeName: placeholder.shapeName,
        containerType: placeholder.containerType,
        originalText: placeholder.originalText
      })),
      previewUrl: slide.previewFileId
        ? `/api/templates/${template.id}/slides/${slide.slideIndex}/preview`
        : null
    }))
  };
}

function findTemplate(id: string) {
  return prisma.reportTemplate.findUnique({
    where: { id },
    include: {
      sourceFile: true,
      slides: {
        orderBy: { slideIndex: "asc" },
        include: { placeholders: { orderBy: { occurrenceIndex: "asc" } } }
      }
    }
  });
}

async function persistParseResult(
  templateId: string,
  parseResult: PptParseResponse,
  renderResult: PptRenderResponse
) {
  const previewsBySlide = new Map(renderResult.files.map((file) => [file.slideIndex, file]));
  if (
    renderResult.pageCount !== parseResult.slides.length ||
    parseResult.slides.some((slide) => !previewsBySlide.has(slide.slideIndex))
  ) {
    throw new Error("PPT parse and preview page counts do not match");
  }

  await prisma.$transaction(async (tx) => {
    const template = await tx.reportTemplate.findUniqueOrThrow({ where: { id: templateId } });
    for (const slide of parseResult.slides) {
      const slideId = randomUUID();
      const preview = previewsBySlide.get(slide.slideIndex)!;
      const previewFileId = randomUUID();
      await tx.storedFile.create({
        data: {
          id: previewFileId,
          category: "PREVIEW",
          storagePath: preview.relativePath,
          originalFilename: `slide-${slide.slideIndex + 1}.png`,
          mimeType: preview.mimeType,
          sizeBytes: BigInt(preview.sizeBytes),
          sha256: preview.sha256,
          createdById: template.createdById
        }
      });
      await tx.templateSlide.create({
        data: {
          id: slideId,
          templateId,
          slideIndex: slide.slideIndex,
          widthEmu: BigInt(slide.widthEmu),
          heightEmu: BigInt(slide.heightEmu),
          previewFileId,
          metadataJson: {
            shapes: slide.shapes,
            warnings: parseResult.warnings.filter((warning) => warning.startsWith(`Slide ${slide.slideIndex + 1} `))
          } as Prisma.InputJsonValue
        }
      });

      if (slide.placeholders.length > 0) {
        await tx.templatePlaceholder.createMany({
          data: slide.placeholders.map((placeholder) => ({
            id: randomUUID(),
            slideId,
            key: placeholder.key,
            occurrenceIndex: placeholder.occurrenceIndex,
            shapeId: placeholder.shapeId,
            shapeName: placeholder.shapeName,
            shapeType: placeholder.shapeType,
            containerType: placeholder.containerType,
            paragraphIndex: placeholder.paragraphIndex,
            startRunIndex: placeholder.startRunIndex,
            startOffset: placeholder.startOffset,
            endRunIndex: placeholder.endRunIndex,
            endOffset: placeholder.endOffset,
            tableRow: placeholder.tableRow,
            tableColumn: placeholder.tableColumn,
            xEmu: BigInt(placeholder.geometry.xEmu),
            yEmu: BigInt(placeholder.geometry.yEmu),
            widthEmu: BigInt(placeholder.geometry.widthEmu),
            heightEmu: BigInt(placeholder.geometry.heightEmu),
            originalText: placeholder.originalText,
            styleJson: placeholder.style as Prisma.InputJsonValue
          }))
        });
      }
    }

    await tx.reportTemplate.update({
      where: { id: templateId },
      data: { status: TemplateStatus.READY, parserVersion: parseResult.parserVersion }
    });
    await tx.operationLog.create({
      data: {
        actorId: template.createdById,
        action: "TEMPLATE_PARSE_SUCCEEDED",
        resourceType: "ReportTemplate",
        resourceId: templateId,
        correlationId: randomUUID(),
        afterJson: {
          parserVersion: parseResult.parserVersion,
          slideCount: parseResult.slides.length,
          placeholderCount: parseResult.slides.reduce((sum, slide) => sum + slide.placeholders.length, 0),
          previewCount: renderResult.files.length,
          warnings: [...parseResult.warnings, ...renderResult.warnings]
        }
      }
    });
  });
}

async function markParseFailed(templateId: string, error: unknown) {
  const message = error instanceof Error ? error.message.slice(0, 1_000) : "Unknown parse failure";
  await prisma
    .$transaction(async (tx) => {
      const template = await tx.reportTemplate.update({
        where: { id: templateId },
        data: { status: TemplateStatus.PARSE_FAILED }
      });
      await tx.operationLog.create({
        data: {
          actorId: template.createdById,
          action: "TEMPLATE_PARSE_FAILED",
          resourceType: "ReportTemplate",
          resourceId: templateId,
          correlationId: randomUUID(),
          metadataJson: { message }
        }
      });
    })
    .catch(() => undefined);
}

async function processTemplate(params: {
  templateId: string;
  fileId: string;
  relativePath: string;
  sha256: string;
}) {
  let renderResult: PptRenderResponse | undefined;
  try {
    const [parseOutcome, renderOutcome] = await Promise.allSettled([
      parseTemplate(params),
      renderTemplate({
        ...params,
        idempotencyKey: `template-preview:${params.templateId}:${params.sha256}`
      })
    ]);
    if (renderOutcome.status === "fulfilled") {
      renderResult = renderOutcome.value;
    }
    if (parseOutcome.status === "rejected") {
      throw parseOutcome.reason;
    }
    if (renderOutcome.status === "rejected") {
      throw renderOutcome.reason;
    }
    await persistParseResult(params.templateId, parseOutcome.value, renderOutcome.value);
  } catch (error) {
    if (renderResult) {
      await Promise.all(renderResult.files.map((file) => removeStoredFile(file.relativePath)));
    }
    await markParseFailed(params.templateId, error);
    throw error;
  }
}

export async function uploadTemplate(params: { name: string; file: File }) {
  const actor = await requireCollector();
  const name = templateNameSchema.parse(params.name);
  if (!params.file.name.toLowerCase().endsWith(".pptx")) {
    throw new TemplateUploadError("VALIDATION_ERROR", "只允许上传 .pptx 文件", 400);
  }
  if (params.file.size <= 0 || params.file.size > maxUploadBytes()) {
    throw new TemplateUploadError("VALIDATION_ERROR", "PPTX 文件为空或超过大小限制", 400);
  }
  if (params.file.type && !acceptedMimeTypes.has(params.file.type)) {
    throw new TemplateUploadError("VALIDATION_ERROR", "PPTX MIME 类型不受支持", 400);
  }

  const buffer = Buffer.from(await params.file.arrayBuffer());
  await validatePptxPackage(buffer);
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const templateId = randomUUID();
  const fileId = randomUUID();
  const correlationId = randomUUID();
  const relativePath = await saveTemplateFile({ buffer, templateId, sha256 });
  let templateCreated = false;

  try {
    await prisma.$transaction(
      async (tx) => {
        const latest = await tx.reportTemplate.aggregate({ where: { name }, _max: { version: true } });
        const version = (latest._max.version ?? 0) + 1;
        await tx.storedFile.create({
          data: {
            id: fileId,
            category: "TEMPLATE",
            storagePath: relativePath,
            originalFilename: params.file.name,
            mimeType: params.file.type || "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            sizeBytes: BigInt(params.file.size),
            sha256,
            createdById: actor.id
          }
        });
        await tx.reportTemplate.create({
          data: {
            id: templateId,
            name,
            version,
            status: TemplateStatus.PARSING,
            sourceFileId: fileId,
            sha256,
            createdById: actor.id
          }
        });
        await tx.operationLog.create({
          data: {
            actorId: actor.id,
            action: "TEMPLATE_UPLOAD",
            resourceType: "ReportTemplate",
            resourceId: templateId,
            correlationId,
            afterJson: { name, version, sha256, originalFilename: params.file.name }
          }
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    templateCreated = true;

    await processTemplate({ templateId, fileId, relativePath, sha256 });
    const createdTemplate = await findTemplate(templateId);
    if (!createdTemplate) {
      throw new Error("Template disappeared after parsing");
    }
    return templateDto(createdTemplate);
  } catch (error) {
    if (!templateCreated) {
      await removeStoredFile(relativePath);
    }
    throw error;
  }
}

export async function listTemplates() {
  const actor = await currentActor();
  const templates = await prisma.reportTemplate.findMany({
    where: visibleTemplateWhere(actor),
    orderBy: { createdAt: "desc" },
    include: {
      sourceFile: true,
      slides: {
        orderBy: { slideIndex: "asc" },
        include: { placeholders: { orderBy: { occurrenceIndex: "asc" } } }
      }
    }
  });
  return templates.map((template) => templateDto(template));
}

export async function retryTemplate(templateId: string) {
  const actor = await requireCollector();
  const template = await prisma.reportTemplate.findUnique({
    where: { id: templateId },
    include: { sourceFile: true }
  });
  if (!template) {
    throw new TemplateUploadError("NOT_FOUND", "模板不存在", 404);
  }
  if (template.createdById !== actor.id) {
    throw new TemplateUploadError("NOT_FOUND", "模板不存在", 404);
  }
  if (template.status !== TemplateStatus.PARSE_FAILED) {
    throw new TemplateUploadError("INVALID_STATE", "只有解析失败的模板可以重试", 409);
  }

  await prisma.$transaction(async (tx) => {
    await tx.reportTemplate.update({
      where: { id: templateId },
      data: { status: TemplateStatus.PARSING }
    });
    await tx.operationLog.create({
      data: {
        actorId: template.createdById,
        action: "TEMPLATE_PARSE_RETRY",
        resourceType: "ReportTemplate",
        resourceId: templateId,
        correlationId: randomUUID()
      }
    });
  });

  await processTemplate({
    templateId,
    fileId: template.sourceFile.id,
    relativePath: template.sourceFile.storagePath,
    sha256: template.sourceFile.sha256
  });
  const retried = await findTemplate(templateId);
  if (!retried) {
    throw new Error("Template disappeared after retry");
  }
  return templateDto(retried);
}

export async function getTemplatePreview(templateId: string, slideIndex: number) {
  const actor = await currentActor();
  const authorizedTemplate = await prisma.reportTemplate.findFirst({
    where: { id: templateId, ...visibleTemplateWhere(actor) },
    select: { id: true }
  });
  if (!authorizedTemplate) throw new TemplateUploadError("NOT_FOUND", "页面缩略图不存在", 404);
  const slide = await prisma.templateSlide.findUnique({
    where: { templateId_slideIndex: { templateId, slideIndex } },
    include: { previewFile: true }
  });
  if (!slide?.previewFile) {
    throw new TemplateUploadError("NOT_FOUND", "页面缩略图不存在", 404);
  }
  return {
    bytes: await readStoredFile(slide.previewFile.storagePath),
    mimeType: slide.previewFile.mimeType,
    sha256: slide.previewFile.sha256
  };
}

export async function getTemplateStaticPreview(templateId: string, slideIndex: number) {
  const actor = await currentActor();
  const template = await prisma.reportTemplate.findFirst({
    where: { id: templateId, ...visibleTemplateWhere(actor) },
    select: {
      sourceFile: { select: { storagePath: true, sha256: true } },
      slides: { where: { slideIndex }, select: { id: true }, take: 1 }
    }
  });
  if (!template?.slides.length) throw new TemplateUploadError("NOT_FOUND", "静态预览不存在", 404);
  const bytes = await renderStaticPreview({
    relativePath: template.sourceFile.storagePath,
    sha256: template.sourceFile.sha256,
    slideIndex
  });
  return { bytes, sha256: createHash("sha256").update(bytes).digest("hex") };
}
