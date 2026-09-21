import { describe, expect, it } from "vitest";

import { saveBindingSchema, submitSchema } from "./fill-in-policy";

describe("fill-in request policy", () => {
  it("keeps metric period explicit and validates it independently of report period", () => {
    expect(saveBindingSchema.safeParse({
      expectedVersion: 1, sourceType: "DATABASE_METRIC", metricDefinitionId: "metric-1", metricPeriod: "2026-08"
    }).success).toBe(true);
    expect(saveBindingSchema.safeParse({
      expectedVersion: 1, sourceType: "DATABASE_METRIC", metricDefinitionId: "metric-1", metricPeriod: "2026-13"
    }).success).toBe(false);
  });

  it("requires a value and an optimistic-lock version", () => {
    expect(saveBindingSchema.safeParse({ expectedVersion: 1, sourceType: "MANUAL_TEXT", manualValue: "" }).success).toBe(false);
    expect(submitSchema.safeParse({ expectedVersion: -1 }).success).toBe(false);
  });
});
