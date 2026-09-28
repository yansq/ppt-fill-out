import { describe, expect, it } from "vitest";

import { validateReplacements } from "./sample-template-policy";

const segment = { slideIndex: 0, shapeId: 2, tableRow: null, tableColumn: null, paragraphIndex: 0, text: "产量为 1234 吨，完成率 95%" };

describe("sample template replacement validation", () => {
  it("accepts distinct substrings from the same paragraph", () => {
    expect(() => validateReplacements([segment], [
      { segment, originalText: "1234", key: "production" },
      { segment, originalText: "95%", key: "completion_rate" }
    ])).not.toThrow();
  });

  it("rejects ambiguous and overlapping replacements", () => {
    expect(() => validateReplacements([segment], [{ segment, originalText: "为", key: "a" }, { segment, originalText: "为 1234", key: "b" }])).toThrow();
    expect(() => validateReplacements([segment], [{ segment, originalText: "0", key: "a" }])).toThrow();
    expect(() => validateReplacements([segment], [{ segment: { ...segment, text: "tampered" }, originalText: "1234", key: "a" }])).toThrow();
  });
});
