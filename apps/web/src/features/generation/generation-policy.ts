import { z } from "zod";

export const generateSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  idempotencyKey: z.string().uuid()
});

export const exportSchema = z.object({ generatedFileId: z.string().min(1).max(191) });

export function missingFinalValues(
  placeholders: { id: string; key: string; slideIndex: number; occurrenceIndex: number }[],
  finalPlaceholderIds: Set<string>
) {
  return placeholders.filter((placeholder) => !finalPlaceholderIds.has(placeholder.id));
}
