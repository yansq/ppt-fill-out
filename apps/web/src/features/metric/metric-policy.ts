import { z } from "zod";

export const periodSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "年月必须为 YYYY-MM");
export const metricYearSchema = z.string().regex(/^\d{4}$/, "年份必须为 YYYY");

export const updateMetricSchema = z.object({
  period: periodSchema,
  value: z.string().trim().min(1).max(2000),
  expectedVersion: z.number().int().min(0),
  reason: z.string().trim().min(3).max(1000)
});

export const demoQueryConfigSchema = z.object({
  adapter: z.literal("demo_metric_record"),
  sourceCode: z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/)
});
