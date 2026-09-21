import { z } from "zod";

import { periodSchema } from "../metric/metric-policy";

const base = { expectedVersion: z.number().int().min(0) };

export const saveBindingSchema = z.discriminatedUnion("sourceType", [
  z.object({
    ...base,
    sourceType: z.literal("MANUAL_TEXT"),
    manualValue: z.string().trim().min(1).max(2000)
  }),
  z.object({
    ...base,
    sourceType: z.literal("DATABASE_METRIC"),
    metricDefinitionId: z.string().min(1).max(191),
    metricPeriod: periodSchema
  })
]);

export const submitSchema = z.object({ expectedVersion: z.number().int().min(0) });
