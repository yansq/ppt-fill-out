type AssignedPage = {
  id: string;
  status: string;
  slideIndex: number;
  task: { id: string; name: string; reportPeriod: string };
};

function isSubmitted(status: string) {
  return status === "SUBMITTED" || status === "REVIEWED";
}

function nextPagePriority(status: string) {
  if (status === "RETURNED") return 0;
  if (status === "IN_PROGRESS") return 1;
  return 2;
}

export function summarizeMyReports(pages: AssignedPage[]) {
  const byTask = new Map<string, AssignedPage[]>();
  for (const page of pages) {
    const assigned = byTask.get(page.task.id) ?? [];
    assigned.push(page);
    byTask.set(page.task.id, assigned);
  }

  return [...byTask.values()].map((assigned) => {
    const ordered = [...assigned].sort((a, b) => a.slideIndex - b.slideIndex);
    const pending = ordered.filter((page) => !isSubmitted(page.status))
      .sort((a, b) => nextPagePriority(a.status) - nextPagePriority(b.status) || a.slideIndex - b.slideIndex);
    const nextPage = pending[0] ?? ordered[0];
    const submittedPages = assigned.length - pending.length;
    return {
      task: assigned[0].task,
      totalPages: assigned.length,
      submittedPages,
      returnedPages: pending.filter((page) => page.status === "RETURNED").length,
      nextPage: { id: nextPage.id, slideIndex: nextPage.slideIndex },
      complete: pending.length === 0
    };
  }).sort((a, b) => Number(a.complete) - Number(b.complete));
}
