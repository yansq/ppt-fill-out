"use client";

import { useState, type CSSProperties } from "react";
import Image from "next/image";

export function PptPreviewImage({ src, fallbackSrc, alt, aspectRatio }: {
  src: string;
  fallbackSrc?: string;
  alt: string;
  aspectRatio?: number;
}) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  return <div className="ppt-preview-image relative overflow-hidden rounded border bg-background" style={{ "--preview-aspect-ratio": aspectRatio ?? 16 / 9 } as CSSProperties}>
    {fallbackSrc && state !== "ready" ? <Image alt="" className="absolute inset-0 h-full w-full object-contain" height={720} loading="eager" src={fallbackSrc} unoptimized width={1280} /> : null}
    <Image alt={alt} className={`absolute inset-0 h-full w-full object-contain ${state === "ready" ? "opacity-100" : "opacity-0"}`} fetchPriority="high" height={720} loading="eager" onError={() => setState("error")} onLoad={() => setState("ready")} src={src} unoptimized width={1280} />
    {state === "loading" ? <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/70 text-center" role="status">
      <span aria-hidden="true" className="size-8 rounded-full border-4 border-primary/20 border-t-primary motion-safe:animate-spin" />
      <span className="rounded-md bg-card px-3 py-2 text-sm font-medium">正在渲染页面预览，请稍候…</span>
    </div> : null}
    {state === "error" ? <div className="absolute inset-x-0 bottom-0 bg-card/95 p-3 text-center text-sm" role="alert">预览加载失败，请刷新页面重试。</div> : null}
  </div>;
}
