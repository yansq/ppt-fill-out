"use client";

import { useState } from "react";

import { AssignmentForm } from "./assignment-form";
import { ReviewPanel } from "../review/review-panel";

import type { ComponentProps } from "react";

type FillingTaskWorkspaceProps = {
  assignment: ComponentProps<typeof AssignmentForm>;
  review: ComponentProps<typeof ReviewPanel>["initial"];
};

export function FillingTaskWorkspace({
  assignment,
  review,
}: FillingTaskWorkspaceProps) {
  const [view, setView] = useState<"progress" | "assignments">("progress");

  return (
    <section aria-label="填报任务工作区">
      <div aria-label="任务视图" className="task-view-switch" role="group">
        <button
          aria-controls="task-progress-panel"
          aria-pressed={view === "progress"}
          onClick={() => setView("progress")}
          type="button"
        >
          逐页填报
        </button>
        <button
          aria-controls="task-assignments-panel"
          aria-pressed={view === "assignments"}
          onClick={() => setView("assignments")}
          type="button"
        >
          调整页面分配
        </button>
      </div>
      <div hidden={view !== "progress"} id="task-progress-panel">
        <ReviewPanel initial={review} />
      </div>
      <div hidden={view !== "assignments"} id="task-assignments-panel">
        <div className="mb-4">
          <p className="mt-1 text-sm muted">
            选择页面后调整负责人员，完成后统一保存。
          </p>
        </div>
        <AssignmentForm
          key={`${assignment.taskId}-${assignment.version}`}
          {...assignment}
        />
      </div>
    </section>
  );
}
