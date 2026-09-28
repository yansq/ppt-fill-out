"use client";

import { useEffect, useState } from "react";

const storageKey = "report-platform:sidebar-collapsed";

export function WorkspaceFrame({ sidebar, children }: { sidebar: React.ReactNode; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setCollapsed(window.localStorage.getItem(storageKey) === "true");
      } catch {
        // The sidebar still works when browser storage is unavailable.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function toggleSidebar() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      window.localStorage.setItem(storageKey, String(next));
    } catch {
      // Keep the current page interactive when browser storage is unavailable.
    }
  }

  return <div className="workspace" data-sidebar-collapsed={collapsed}>
    {sidebar}
    <button
      aria-controls="workspace-sidebar"
      aria-expanded={!collapsed}
      aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
      className="workspace-sidebar-toggle"
      onClick={toggleSidebar}
      title={collapsed ? "展开侧边栏" : "收起侧边栏"}
      type="button"
    >
      <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 16 16" width="16">
        <rect height="12" rx="2" stroke="currentColor" strokeWidth="1.3" width="13" x="1.5" y="2" />
        <path d="M5.5 2v12" stroke="currentColor" strokeWidth="1.3" />
        <path d={collapsed ? "m9 5 3 3-3 3" : "m11 5-3 3 3 3"} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
      </svg>
    </button>
    <div className="workspace-content">{children}</div>
  </div>;
}
