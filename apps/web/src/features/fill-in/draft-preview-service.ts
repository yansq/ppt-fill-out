import { createHash } from "node:crypto";

import { prisma } from "@report-platform/database";

import {
  getFillInstance,
  ReportTaskError,
} from "@/features/report-task/report-task-service";
import { renderDraftPreview } from "@/features/template/ppt-service-client";

import { getCachedDraftPreview } from "./draft-preview-cache";

export async function getDraftPreview(
  instanceId: string,
  expectedVersion: number,
  highlightedPlaceholderId?: string | null,
) {
  const instance = await getFillInstance(instanceId);
  if (instance.version !== expectedVersion) {
    throw new ReportTaskError(
      "VERSION_CONFLICT",
      "填报草稿已更新，请刷新预览",
      409,
    );
  }
  const highlightedPlaceholder = highlightedPlaceholderId
    ? instance.placeholders.find((placeholder) => placeholder.id === highlightedPlaceholderId)
    : null;
  if (highlightedPlaceholderId && !highlightedPlaceholder) {
    throw new ReportTaskError("VALIDATION_ERROR", "填报项无效", 400);
  }
  return getCachedDraftPreview(
    `${instance.id}:${expectedVersion}:${highlightedPlaceholderId ?? "plain"}`,
    async () => {
      const task = await prisma.reportTask.findUniqueOrThrow({
        where: { id: instance.task.id },
        select: {
          template: {
            select: {
              sourceFile: { select: { storagePath: true, sha256: true } },
            },
          },
        },
      });
      const bindings = new Map(
        instance.bindings.map((binding) => [binding.placeholderId, binding]),
      );
      const values = instance.placeholders.map((placeholder) => {
        const binding = bindings.get(placeholder.id);
        const snapshot = binding?.sourceSnapshotJson as {
          valueText?: unknown;
        } | null;
        return {
          key: placeholder.key,
          occurrenceIndex: placeholder.occurrenceIndex,
          valueText:
            binding?.sourceType === "MANUAL_TEXT"
              ? (binding.manualValue ?? "")
              : typeof snapshot?.valueText === "string"
                ? snapshot.valueText
                : "",
        };
      });
      const bytes = await renderDraftPreview({
        relativePath: task.template.sourceFile.storagePath,
        sha256: task.template.sourceFile.sha256,
        slideIndex: instance.slideIndex,
        values,
        highlight: highlightedPlaceholder ? {
          key: highlightedPlaceholder.key,
          occurrenceIndex: highlightedPlaceholder.occurrenceIndex,
        } : undefined,
      });
      return {
        bytes,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      };
    },
  );
}
