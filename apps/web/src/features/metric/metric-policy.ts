import { z } from "zod";

export const periodSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "年月必须为 YYYY-MM");
export const metricYearSchema = z.string().regex(/^\d{4}$/, "年份必须为 YYYY");

export const metricCatalogQuerySchema = z.object({
  period: periodSchema,
  page: z.coerce.number().int().min(1).max(100000).default(1),
  search: z.string().trim().max(100).default("")
});

export const updateMetricSchema = z.object({
  period: periodSchema,
  value: z.string().trim().min(1).max(2000),
  expectedVersion: z.number().int().min(0),
  reason: z.string().trim().min(3).max(1000)
});

export const createManualMetricSchema = z.object({
  period: periodSchema,
  code: z.string().trim().min(1).max(191).regex(/^[A-Za-z0-9_-]+$/, "指标编码只能使用字母、数字、下划线和连字符"),
  name: z.string().trim().min(1).max(191),
  value: z.string().trim().min(1).max(2000),
  valueType: z.enum(["STRING", "NUMBER"]),
  unit: z.string().trim().max(64).default("")
});

export const demoQueryConfigSchema = z.object({
  adapter: z.literal("demo_metric_record"),
  sourceCode: z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/)
});
