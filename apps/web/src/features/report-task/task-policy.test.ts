import { describe, expect, it } from "vitest";

import { createTaskSchema, replaceAssignmentsSchema, taskProgress } from "./task-policy";

describe("report task policy", () => {
  it("accepts a real report month and rejects invalid month values", () => {
    expect(createTaskSchema.parse({ name: " 月报 ", templateId: "template-1", reportPeriod: "2026-09" }).name).toBe("月报");
    expect(createTaskSchema.safeParse({ name: "月报", templateId: "template-1", reportPeriod: "2026-13" }).success).toBe(false);
    expect(createTaskSchema.safeParse({ name: "月报", templateId: "template-1", reportPeriod: "2026-9" }).success).toBe(false);
  });

  it("allows several Fillers on one slide but rejects duplicate pairs", () => {
    expect(replaceAssignmentsSchema.safeParse({
      expectedVersion: 0,
      assignments: [
        { slideId: "slide-1", assigneeId: "alice" },
        { slideId: "slide-1", assigneeId: "bob" }
      ]
    }).success).toBe(true);
    expect(replaceAssignmentsSchema.safeParse({
      expectedVersion: 0,
      assignments: [
        { slideId: "slide-1", assigneeId: "alice" },
        { slideId: "slide-1", assigneeId: "alice" }
      ]
    }).success).toBe(false);
  });

  it("reports assigned, started and submitted progress separately", () => {
    expect(taskProgress([])).toEqual({ total: 0, started: 0, submitted: 0, percent: 0 });
    expect(taskProgress(["NOT_STARTED", "IN_PROGRESS", "SUBMITTED", "REVIEWED"])).toEqual({
      total: 4,
      started: 3,
      submitted: 2,
      percent: 50
    });
  });
});
