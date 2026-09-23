"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { Button } from "@report-platform/ui/button";

type Filler = { id: string; employeeNumber: string; username: string; name: string | null; status: string };
type Slide = {
  id: string;
  slideIndex: number;
  previewUrl: string | null;
  placeholderCount: number;
  assignments: { assignee: { id: string } }[];
};

function fillerLabel(filler: Filler) {
  return `${filler.name || filler.username}（${filler.employeeNumber}）`;
}

function SlideAssignment({ slide, fillers, selected, pending, onToggle }: {
  slide: Slide;
  fillers: Filler[];
  selected: Set<string>;
  pending: boolean;
  onToggle: (key: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const pageNumber = slide.slideIndex + 1;
  const assigned = fillers.filter((filler) => selected.has(`${slide.id}:${filler.id}`));
  const search = query.trim().toLocaleLowerCase("zh-CN");
  const matching = fillers.filter((filler) =>
    `${filler.name ?? ""} ${filler.username} ${filler.employeeNumber}`.toLocaleLowerCase("zh-CN").includes(search)
  );

  return <article className="overflow-hidden rounded-xl border bg-card">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1"><h3 className="shrink-0 font-semibold">第 {pageNumber} 页</h3><p className="text-sm muted">{slide.placeholderCount ? `${slide.placeholderCount} 处需要填写` : "本页没有需要填写的内容"}</p></div>
      <span className="status-pill">{slide.placeholderCount ? `已选 ${assigned.length} 人` : "无需分配"}</span>
    </div>
    <div className="grid gap-6 p-5 lg:grid-cols-2">
      <div>
        {slide.previewUrl ? <a aria-label={`查看第 ${pageNumber} 页大图`} className="block overflow-hidden rounded-lg border bg-background" href={slide.previewUrl} rel="noopener noreferrer" target="_blank">
          <Image alt={`第 ${pageNumber} 页演示文稿预览`} className="aspect-video h-auto w-full object-contain" height={360} src={slide.previewUrl} unoptimized width={640} />
        </a> : <div className="flex aspect-video items-center justify-center rounded-lg border bg-background text-sm muted">暂无页面预览</div>}
        {slide.previewUrl ? <p className="mt-2 text-xs muted">点击图片查看大图</p> : null}
      </div>
      <div className="min-w-0">
        {slide.placeholderCount === 0 ? <div className="rounded-lg bg-accent p-4 text-sm text-accent-foreground">这一页没有占位符，不需要填报人。报告生成时会保留原页内容。{slide.assignments.length ? `当前还有 ${slide.assignments.length} 条旧分配，保存时会尝试移除；已经开始填报的分配不能撤销。` : ""}</div> : <>
          <p className="mb-3 text-sm font-medium">负责本页的填报人</p>
          {assigned.length ? <div aria-label={`第 ${pageNumber} 页已选填报人`} className="mb-4 flex flex-wrap gap-2">
            {assigned.map((filler) => <span className="inline-flex max-w-full items-center gap-2 rounded-full border bg-accent py-1 pl-3 pr-1 text-sm" key={filler.id}>
              <span className="truncate">{fillerLabel(filler)}{filler.status !== "ACTIVE" ? " · 已停用" : ""}</span>
              <button aria-label={`移除第 ${pageNumber} 页的 ${fillerLabel(filler)}`} className="rounded-full px-2 py-0.5 text-base hover:bg-background" disabled={pending} onClick={() => onToggle(`${slide.id}:${filler.id}`)} type="button">×</button>
            </span>)}
          </div> : <p className="mb-4 text-sm muted">尚未选择填报人</p>}
          <Button aria-expanded={pickerOpen} aria-label={`选择第 ${pageNumber} 页填报人`} disabled={pending || fillers.length === 0} onClick={() => setPickerOpen((open) => !open)} type="button" variant="outline">{pickerOpen ? "收起人员列表" : "搜索并选择填报人"}</Button>
          {pickerOpen ? <div className="mt-3 rounded-lg border bg-background p-3">
            <label className="grid gap-2 text-sm font-medium">搜索姓名或工号
              <input aria-label={`搜索第 ${pageNumber} 页填报人`} autoComplete="off" className="h-10 w-full rounded-md border bg-card px-3" onChange={(event) => setQuery(event.target.value)} placeholder="输入姓名或工号" type="search" value={query} />
            </label>
            <div aria-label={`第 ${pageNumber} 页可选填报人`} className="mt-3 max-h-52 overflow-y-auto" role="group">
              {matching.slice(0, 50).map((filler) => {
                const key = `${slide.id}:${filler.id}`;
                const checked = selected.has(key);
                return <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-accent" key={filler.id}>
                  <input checked={checked} disabled={pending || (filler.status !== "ACTIVE" && !checked)} onChange={() => onToggle(key)} type="checkbox" />
                  <span>{fillerLabel(filler)}{filler.status !== "ACTIVE" ? " · 已停用" : ""}</span>
                </label>;
              })}
              {matching.length === 0 ? <p className="px-2 py-3 text-sm muted">没有匹配的填报人</p> : null}
              {matching.length > 50 ? <p className="px-2 py-2 text-xs muted">仅显示前 50 人，请继续输入以缩小范围</p> : null}
            </div>
          </div> : null}
        </>}
      </div>
    </div>
  </article>;
}

export function AssignmentForm({ taskId, version, slides, fillers }: {
  taskId: string;
  version: number;
  slides: Slide[];
  fillers: Filler[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(() => new Set(slides.filter((slide) => slide.placeholderCount > 0).flatMap((slide) =>
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
    const assignments = slides.filter((slide) => slide.placeholderCount > 0).flatMap((slide) => fillers
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

  const assignableCount = slides.filter((slide) => slide.placeholderCount > 0).length;
  return <div className="space-y-5">
    <p className="text-sm muted">共 {slides.length} 页，其中 {assignableCount} 页需要填报。可按页搜索并选择一位或多位填报人。</p>
    {fillers.length === 0 && assignableCount > 0 ? <p className="text-sm">暂无可分配的填报人，请联系管理员添加账号。</p> : null}
    {slides.map((slide) => <SlideAssignment fillers={fillers} key={slide.id} onToggle={toggle} pending={pending} selected={selected} slide={slide} />)}
    <div className="flex flex-wrap items-center gap-4">
      <Button disabled={pending} onClick={save} type="button">{pending ? "保存中…" : "保存页面分配"}</Button>
      {message ? <span className="text-sm" role="status">{message}</span> : null}
    </div>
    <p className="text-xs muted">已有填报痕迹的分配不能撤销；若其他人同时修改了任务，请刷新后重试。</p>
  </div>;
}
