import { describe, expect, it } from "vitest";

import { hasContinuousHistory } from "./metric-sync-policy";

describe("metric mirror history continuity", () => {
  it("accepts complete source versions and an unchanged source", () => {
    expect(hasContinuousHistory([{ oldVersion: 1, newVersion: 2 }, { oldVersion: 2, newVersion: 3 }], 1, 3)).toBe(true);
    expect(hasContinuousHistory([], 3, 3)).toBe(true);
  });

  it("rejects gaps, repeats and missing final versions", () => {
    expect(hasContinuousHistory([{ oldVersion: 1, newVersion: 3 }], 1, 3)).toBe(false);
    expect(hasContinuousHistory([{ oldVersion: 1, newVersion: 2 }, { oldVersion: 1, newVersion: 2 }], 1, 2)).toBe(false);
    expect(hasContinuousHistory([{ oldVersion: 1, newVersion: 2 }], 1, 3)).toBe(false);
  });
});
