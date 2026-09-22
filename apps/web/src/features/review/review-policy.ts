import { z } from "zod";

export const decisionSchema = z.discriminatedUnion("resolutionType", [
  z.object({ resolutionType: z.literal("SELECTED_SUBMISSION"), selectedSubmittedValueId: z.string().min(1), expectedVersion: z.number().int().min(0) }),
  z.object({ resolutionType: z.literal("MANUAL"), valueText: z.string().trim().min(1).max(100_000), expectedVersion: z.number().int().min(0) })
]);

export const returnSchema = z.object({ expectedVersion: z.number().int().min(0), reason: z.string().trim().min(1).max(1000) });
export const completeSchema = z.object({ expectedVersion: z.number().int().min(0) });

export function submissionStatus(values: string[], expectedCount: number) {
  if (expectedCount === 0 || values.length < expectedCount) return "MISSING" as const;
  return new Set(values).size === 1 ? "CONSISTENT" as const : "CONFLICT" as const;
}
