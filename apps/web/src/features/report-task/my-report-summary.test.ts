import { describe, expect, it } from "vitest";

import { summarizeMyReports } from "./my-report-summary";

describe("filler workbench report summaries", () => {
  it("groups assigned pages by task and counts submitted pages", () => {
    const task = { id: "report-1", name: "月报", reportPeriod: "2026-09" };
    const sameNameDifferentTask = { id: "report-2", name: "月报", reportPeriod: "2026-09" };
    const summaries = summarizeMyReports([
      { id: "page-4", status: "NOT_STARTED", slideIndex: 3, task },
      { id: "another-report", status: "SUBMITTED", slideIndex: 0, task: sameNameDifferentTask },
      { id: "page-1", status: "SUBMITTED", slideIndex: 0, task },
      { id: "page-3", status: "RETURNED", slideIndex: 2, task }
    ]);

    expect(summaries).toHaveLength(2);
    expect(summaries[0]).toMatchObject({
      task: { id: "report-1" }, totalPages: 3, submittedPages: 1, returnedPages: 1,
      nextPage: { id: "page-3", slideIndex: 2 }, complete: false
    });
    expect(summaries[1]).toMatchObject({
      task: { id: "report-2" }, totalPages: 1, submittedPages: 1, complete: true
    });
  });
});
