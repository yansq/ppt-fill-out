import { describe, expect, it } from "vitest";

import { decisionSchema, submissionStatus } from "./review-policy";

describe("review policy", () => {
  it("marks missing, consistent and conflicting submissions", () => {
    expect(submissionStatus([], 2)).toBe("MISSING");
    expect(submissionStatus([], 0)).toBe("MISSING");
    expect(submissionStatus(["甲"], 2)).toBe("MISSING");
    expect(submissionStatus(["甲", "甲"], 2)).toBe("CONSISTENT");
    expect(submissionStatus(["甲", "乙"], 2)).toBe("CONFLICT");
  });

  it("requires a version and an explicit manual or submitted choice", () => {
    expect(decisionSchema.safeParse({ resolutionType: "MANUAL", valueText: "", expectedVersion: 0 }).success).toBe(false);
    expect(decisionSchema.safeParse({ resolutionType: "SELECTED_SUBMISSION", selectedSubmittedValueId: "s1", expectedVersion: 0 }).success).toBe(true);
    expect(decisionSchema.safeParse({ resolutionType: "DATABASE_METRIC", metricDefinitionId: "m1", metricPeriod: "2026-09", expectedVersion: 0 }).success).toBe(true);
    expect(decisionSchema.safeParse({ resolutionType: "DATABASE_METRIC", metricDefinitionId: "m1", metricPeriod: "2026-13", expectedVersion: 0 }).success).toBe(false);
  });
});
