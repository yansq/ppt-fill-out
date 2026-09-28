import Link from "next/link";

import { signOut } from "@/auth";
import { WorkspaceFrame } from "./workspace-frame";

type Section = "home" | "tasks" | "mine" | "templates" | "metrics" | "sources" | "account";

const collectorLinks = [
  { href: "/report-tasks", label: "报告任务", section: "tasks" },
  { href: "/templates", label: "PPT 模板", section: "templates" },
  { href: "/metrics", label: "指标管理", section: "metrics" },
  { href: "/data-sources", label: "数据源", section: "sources" },
] as const;

export function WorkspaceShell({ children, section, username, employeeNumber, collector, filler }: {
  children: React.ReactNode;
  section: Section;
  username: string;
  employeeNumber: string;
  collector: boolean;
  filler: boolean;
}) {
  return <WorkspaceFrame sidebar={<aside className="workspace-sidebar" aria-label="工作区侧栏" id="workspace-sidebar">
      <Link aria-label="返回报告工作台" className="brand" href="/"><span className="brand-mark">报</span><span className="brand-text">报告协作<span>工作空间</span></span></Link>
      <nav aria-label="主导航" className="workspace-nav">
        <Link aria-current={section === "home" ? "page" : undefined} className="workspace-nav-link" href="/">工作台</Link>
        {collector ? <>
          <p className="nav-group-label">报告管理</p>
          {collectorLinks.map((link) => <Link aria-current={section === link.section ? "page" : undefined} className="workspace-nav-link" href={link.href} key={link.href}>{link.label}</Link>)}
        </> : null}
        {filler ? <>
          <p className="nav-group-label">个人工作</p>
          <Link aria-current={section === "mine" ? "page" : undefined} className="workspace-nav-link" href="/my-tasks">我的填报</Link>
        </> : null}
      </nav>
      <div className="workspace-account">
        <div className="account-identity"><span className="account-avatar" aria-hidden="true">{username.slice(0, 1)}</span><span className="account-details"><strong title={username}>{username}</strong><small>工号 {employeeNumber}</small></span></div>
        <div className="account-actions"><Link aria-current={section === "account" ? "page" : undefined} href="/account/password">修改密码</Link><form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}><button type="submit">退出登录</button></form></div>
      </div>
    </aside>}>
    {children}
  </WorkspaceFrame>;
}
