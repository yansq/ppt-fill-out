import { describe, expect, it } from "vitest";

import { generateSchema, missingFinalValues } from "./generation-policy";

describe("generation policy", () => {
  it("reports every template placeholder without a final value", () => {
    const placeholders = [
      { id: "one", key: "a", slideIndex: 0, occurrenceIndex: 0 },
      { id: "two", key: "a", slideIndex: 0, occurrenceIndex: 1 },
      { id: "three", key: "b", slideIndex: 2, occurrenceIndex: 0 }
    ];
    expect(missingFinalValues(placeholders, new Set(["one"]))).toEqual(placeholders.slice(1));
  });

  it("requires task version and stable retry key", () => {
    expect(generateSchema.safeParse({ expectedVersion: 0, idempotencyKey: "not-a-uuid" }).success).toBe(false);
    expect(generateSchema.safeParse({ expectedVersion: 3, idempotencyKey: "9ad60067-96a3-4cae-ae39-90f0d8f55548" }).success).toBe(true);
  });
});
