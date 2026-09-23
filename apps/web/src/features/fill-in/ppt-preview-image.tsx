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
    {state === "loading" ? <div className="ppt-preview-loading absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 overflow-hidden p-5 text-center" role="status">
      <div aria-hidden="true" className="ppt-preview-loading-slide relative aspect-video w-36 max-w-1/2 overflow-hidden rounded-md border p-4 shadow-xl sm:w-44">
        <span className="mb-3 block h-2 w-2/3 rounded-full bg-white/80" />
        <span className="mb-2 block h-1.5 w-full rounded-full bg-white/35" />
        <span className="mb-2 block h-1.5 w-4/5 rounded-full bg-white/35" />
        <span className="block h-1.5 w-1/2 rounded-full bg-white/35" />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold sm:text-base">正在渲染页面预览，请稍候…</p>
        <p className="text-xs opacity-75">正在准备 PPT 页面</p>
      </div>
      <div aria-hidden="true" className="ppt-preview-loading-track h-1 w-36 overflow-hidden rounded-full sm:w-44"><span className="ppt-preview-loading-progress block h-full w-1/3 rounded-full" /></div>
    </div> : null}
    {state === "error" ? <div className="absolute inset-x-0 bottom-0 bg-card/95 p-3 text-center text-sm" role="alert">预览加载失败，请刷新页面重试。</div> : null}
  </div>;
}
