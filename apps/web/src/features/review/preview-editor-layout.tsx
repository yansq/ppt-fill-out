"use client";

import { useRef, useState } from "react";

import type {
  CSSProperties,
  KeyboardEvent,
  PointerEvent,
  ReactNode,
} from "react";

const DEFAULT_PREVIEW_PERCENT = 64;
const RESIZE_HANDLE_WIDTH = 8;

export function PreviewEditorLayout({
  preview,
  editor,
}: {
  preview: ReactNode;
  editor: ReactNode;
}) {
  const layoutRef = useRef<HTMLDivElement>(null);
  const [previewPercent, setPreviewPercent] = useState(DEFAULT_PREVIEW_PERCENT);
  const [limits, setLimits] = useState({ min: 40, max: 75 });

  function allowedPercent() {
    const width =
      (layoutRef.current?.getBoundingClientRect().width ?? 0) -
      RESIZE_HANDLE_WIDTH;
    if (width <= 0) return { min: 40, max: 75 };
    const min = Math.max(40, Math.round((360 / width) * 100));
    const max = Math.min(75, Math.round(((width - 320) / width) * 100));
    return min <= max ? { min, max } : { min: 50, max: 50 };
  }

  function setFromPointer(event: PointerEvent<HTMLDivElement>) {
    const rect = layoutRef.current?.getBoundingClientRect();
    if (!rect) return;
    const availableWidth = rect.width - RESIZE_HANDLE_WIDTH;
    const minimumPreview = Math.min(360, availableWidth / 2);
    const minimumEditor = Math.min(320, availableWidth / 2);
    const requestedWidth = event.clientX - rect.left;
    const width = Math.max(
      minimumPreview,
      Math.min(availableWidth - minimumEditor, requestedWidth),
    );
    const { min, max } = allowedPercent();
    setLimits({ min, max });
    setPreviewPercent(
      Math.max(min, Math.min(max, Math.round((width / availableWidth) * 100))),
    );
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const next =
      event.key === "ArrowLeft"
        ? previewPercent - 5
        : event.key === "ArrowRight"
          ? previewPercent + 5
          : event.key === "Home"
            ? 40
            : event.key === "End"
              ? 75
              : null;
    if (next === null) return;
    event.preventDefault();
    const { min, max } = allowedPercent();
    setLimits({ min, max });
    setPreviewPercent(Math.max(min, Math.min(max, next)));
  }

  return (
    <div
      className="review-content-layout"
      ref={layoutRef}
      style={
        {
          "--preview-share": `${previewPercent}fr`,
          "--editor-share": `${100 - previewPercent}fr`,
        } as CSSProperties
      }
    >
      {preview}
      <div
        aria-label="调整 PPT 预览宽度"
        aria-orientation="vertical"
        aria-valuemax={limits.max}
        aria-valuemin={limits.min}
        aria-valuenow={previewPercent}
        className="review-resize-handle"
        onDoubleClick={() => setPreviewPercent(DEFAULT_PREVIEW_PERCENT)}
        onKeyDown={onKeyDown}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setFromPointer(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            setFromPointer(event);
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        role="separator"
        tabIndex={0}
      >
        <span aria-hidden="true" />
      </div>
      {editor}
    </div>
  );
}
