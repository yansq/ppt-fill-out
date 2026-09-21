"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@report-platform/ui/button";

type Filler = { id: string; username: string; name: string | null; status: string };
type Slide = {
  id: string;
  slideIndex: number;
  assignments: { assignee: { id: string } }[];
};

export function AssignmentForm({ taskId, version, slides, fillers }: {
  taskId: string;
  version: number;
  slides: Slide[];
  fillers: Filler[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(() => new Set(slides.flatMap((slide) =>
    slide.assignments.map((assignment) => `${slide.id}:${assignment.assignee.id}`)
  )));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  function toggle(key: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function save() {
    setPending(true);
    setMessage("");
    const assignments = slides.flatMap((slide) => fillers
      .filter((filler) => selected.has(`${slide.id}:${filler.id}`))
      .map((filler) => ({ slideId: slide.id, assigneeId: filler.id })));
    try {
      const response = await fetch(`/api/report-tasks/${taskId}/assignments`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: version, assignments })
      });
      const payload = await response.json() as { error?: { message: string } };
      if (!response.ok) {
        setMessage(payload.error?.message ?? "保存分配失败");
        return;
      }
      setMessage("分配已保存");
      router.refresh();
    } catch {
      setMessage("任务服务暂时不可用");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      {fillers.length === 0 ? <p className="text-sm">暂无可分配的 Filler。先通过 seed:auth 预置填报人。</p> : null}
      {slides.map((slide) => (
        <fieldset className="rounded-md border p-4" key={slide.id}>
          <legend className="px-1 text-sm font-semibold">第 {slide.slideIndex + 1} 页</legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {fillers.map((filler) => {
              const key = `${slide.id}:${filler.id}`;
              return (
                <label className="flex items-center gap-2 text-sm" key={key}>
                  <input checked={selected.has(key)} onChange={() => toggle(key)} type="checkbox" />
                  <span>{filler.name || filler.username} <span>({filler.username})</span>{filler.status !== "ACTIVE" ? " · 已停用" : ""}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
      <div className="flex items-center gap-4">
        <Button disabled={pending || fillers.length === 0} onClick={save} type="button">
          {pending ? "保存中…" : "保存页面分配"}
        </Button>
        {message ? <span className="text-sm" role="status">{message}</span> : null}
      </div>
      <p className="text-xs">同页可选择多人。已有填报痕迹的分配不能撤销；并发修改会要求刷新。</p>
    </div>
  );
}
