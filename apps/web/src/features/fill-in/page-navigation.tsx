"use client";

import Image from "next/image";
import Link from "next/link";

import { Button } from "@report-platform/ui/button";

import { instanceStatusText } from "../../components/status";

type Page = { id: string; slideIndex: number; previewUrl: string; status: string };

export type FillPageNavigationData = {
  currentId: string;
  pages: Page[];
};

export function FillPageNavigation({ navigation, unsaved = false, pending = false, currentStatus }: {
  navigation: FillPageNavigationData;
  unsaved?: boolean;
  pending?: boolean;
  currentStatus?: string;
}) {
  const currentIndex = navigation.pages.findIndex((page) => page.id === navigation.currentId);
  if (currentIndex < 0) return null;
  const previous = navigation.pages[currentIndex - 1];
  const next = navigation.pages[currentIndex + 1];

  function confirmLeave(event: React.MouseEvent<HTMLAnchorElement>) {
    if (unsaved && !window.confirm("本页有未保存的修改，切换页面后会丢失。仍要继续吗？")) {
      event.preventDefault();
    }
  }

  return <nav aria-label="填报页面导航" className="fill-page-nav min-w-0 rounded-xl border bg-card p-3">
    <div className="flex flex-wrap items-center justify-between gap-2 xl:block">
      <div><p className="font-semibold">报告页面</p><p className="mt-1 text-xs muted">你负责的第 {currentIndex + 1} / {navigation.pages.length} 页</p></div>
      <div className="flex gap-2 xl:mt-3">
        {previous && !pending ? <Button asChild className="min-w-0 flex-1" size="sm" variant="outline"><Link href={`/fill-instances/${previous.id}`} onClick={confirmLeave}>上一项</Link></Button> : <Button className="min-w-0 flex-1" disabled size="sm" type="button" variant="outline">上一项</Button>}
        {next && !pending ? <Button asChild className="min-w-0 flex-1" size="sm" variant="outline"><Link href={`/fill-instances/${next.id}`} onClick={confirmLeave}>下一项</Link></Button> : <Button className="min-w-0 flex-1" disabled size="sm" type="button" variant="outline">下一项</Button>}
      </div>
    </div>
    <div aria-label="选择填报页面" className="mt-3 flex gap-3 overflow-x-auto pb-1 xl:grid xl:overflow-visible" role="group">
      {navigation.pages.map((page) => {
        const active = page.id === navigation.currentId;
        const status = active ? currentStatus ?? page.status : page.status;
        const content = <>
          <Image alt="" className="aspect-video w-full rounded border bg-white object-contain" decoding="async" fetchPriority="low" height={144} loading="lazy" src={page.previewUrl} unoptimized width={256} />
          <span className="mt-2 flex items-center justify-between gap-1 text-xs"><strong>第 {page.slideIndex + 1} 页</strong><span className="muted">{instanceStatusText[status] ?? "待处理"}</span></span>
        </>;
        const className = `block w-36 shrink-0 rounded-lg border-2 p-2 xl:w-full ${active ? "border-primary bg-accent" : "border-transparent hover:border-primary/40"}`;
        return active ? <div aria-current="page" aria-label={`当前第 ${page.slideIndex + 1} 页`} className={className} key={page.id}>{content}</div>
          : pending ? <div aria-disabled="true" className={`${className} opacity-60`} key={page.id}>{content}</div>
            : <Link aria-label={`切换到第 ${page.slideIndex + 1} 页`} className={className} href={`/fill-instances/${page.id}`} key={page.id} onClick={confirmLeave}>{content}</Link>;
      })}
    </div>
  </nav>;
}
