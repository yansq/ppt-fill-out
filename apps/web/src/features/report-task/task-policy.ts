import { z } from "zod";

const idSchema = z.string().min(1).max(191);

export const createTaskSchema = z.object({
  name: z.string().trim().min(1).max(191),
  templateId: idSchema,
  reportPeriod: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "报告周期必须为 YYYY-MM")
});

export const replaceAssignmentsSchema = z.object({
  expectedVersion: z.number().int().min(0),
  assignments: z.array(z.union([
    z.object({ slideId: idSchema, assigneeId: idSchema }).strict(),
    z.object({ slideId: idSchema, employeeNumber: z.string().regex(/^\d{6}$/) }).strict()
  ])).max(1000)
}).superRefine(({ assignments }, context) => {
  const seen = new Set<string>();
  for (const assignment of assignments) {
    const key = "assigneeId" in assignment
      ? `${assignment.slideId}:id:${assignment.assigneeId}`
      : `${assignment.slideId}:number:${assignment.employeeNumber}`;
    if (seen.has(key)) {
      context.addIssue({ code: "custom", message: "同一页面不能重复分配给同一填报人" });
      return;
    }
    seen.add(key);
  }
});

export const startInstanceSchema = z.object({ expectedVersion: z.number().int().min(0) });

export function taskProgress(statuses: string[]) {
  const total = statuses.length;
  const started = statuses.filter((status) => status !== "NOT_STARTED").length;
  const submitted = statuses.filter((status) => status === "SUBMITTED" || status === "REVIEWED").length;
  return { total, started, submitted, percent: total === 0 ? 0 : Math.round((submitted / total) * 100) };
}
