"use client";

import { useRef, useState } from "react";

import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from "react";

const DEFAULT_NAV_WIDTH = 180;
const MIN_NAV_WIDTH = 128;
const MAX_NAV_WIDTH = 320;
const MIN_CONTENT_WIDTH = 640;
const HANDLE_WIDTH = 8;

export function PageNavigationLayout({ children, label }: { children: [ReactNode, ReactNode]; label: string }) {
  const layoutRef = useRef<HTMLDivElement>(null);
  const [navWidth, setNavWidth] = useState(DEFAULT_NAV_WIDTH);
  const [maxWidth, setMaxWidth] = useState(MAX_NAV_WIDTH);

  function allowedMax() {
    const width = layoutRef.current?.getBoundingClientRect().width ?? 0;
    return width > 0 ? Math.max(MIN_NAV_WIDTH, Math.min(MAX_NAV_WIDTH, width - HANDLE_WIDTH - MIN_CONTENT_WIDTH)) : MAX_NAV_WIDTH;
  }

  function resize(width: number) {
    const max = allowedMax();
    setMaxWidth(max);
    setNavWidth(Math.max(MIN_NAV_WIDTH, Math.min(max, Math.round(width))));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const next = event.key === "ArrowLeft" ? navWidth - 16
      : event.key === "ArrowRight" ? navWidth + 16
        : event.key === "Home" ? MIN_NAV_WIDTH
          : event.key === "End" ? allowedMax() : null;
    if (next === null) return;
    event.preventDefault();
    resize(next);
  }

  function setFromPointer(event: PointerEvent<HTMLDivElement>) {
    const rect = layoutRef.current?.getBoundingClientRect();
    if (rect) resize(event.clientX - rect.left);
  }

  return <div
    aria-label={label}
    className="review-workspace"
    ref={layoutRef}
    role="group"
    style={{ "--page-nav-width": `${navWidth}px` } as CSSProperties}
  >
    {children[0]}
    <div
      aria-label="调整报告页面栏宽度"
      aria-orientation="vertical"
      aria-valuemax={maxWidth}
      aria-valuemin={MIN_NAV_WIDTH}
      aria-valuenow={navWidth}
      className="review-resize-handle review-page-resize-handle"
      onDoubleClick={() => resize(DEFAULT_NAV_WIDTH)}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setFromPointer(event);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) setFromPointer(event);
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      role="separator"
      tabIndex={0}
    ><span aria-hidden="true" /></div>
    {children[1]}
  </div>;
}
