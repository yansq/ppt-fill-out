import Link from "next/link";

import { signOut } from "@/auth";

type Section = "home" | "tasks" | "mine" | "templates" | "metrics" | "sources" | "account";

const collectorLinks = [
  { href: "/", label: "工作台", section: "home" },
  { href: "/report-tasks", label: "报告任务", section: "tasks" },
  { href: "/templates", label: "模板管理", section: "templates" },
  { href: "/metrics", label: "指标管理", section: "metrics" },
  { href: "/data-sources", label: "数据源", section: "sources" }
] as const;

export function WorkspaceShell({ children, section, username, employeeNumber, collector, filler }: {
  children: React.ReactNode;
  section: Section;
  username: string;
  employeeNumber: string;
  collector: boolean;
  filler: boolean;
}) {
  const links = collector ? collectorLinks : [{ href: "/", label: "工作台", section: "home" }, { href: "/my-tasks", label: "我的填报", section: "mine" }];
  return <div className="workspace">
    <header className="workspace-header">
      <div className="workspace-header-inner">
        <Link aria-label="返回报告工作台" className="brand" href="/"><span className="brand-mark">报</span><span>报告协作平台</span></Link>
        <nav aria-label="主导航" className="workspace-nav">
          {links.map((link) => <Link aria-current={section === link.section ? "page" : undefined} className="workspace-nav-link" href={link.href} key={link.href}>{link.label}</Link>)}
          {collector && filler ? <Link aria-current={section === "mine" ? "page" : undefined} className="workspace-nav-link" href="/my-tasks">我的填报</Link> : null}
        </nav>
        <div className="workspace-account"><span className="account-name">{username}({employeeNumber})</span><Link aria-current={section === "account" ? "page" : undefined} className="account-signout" href="/account/password">修改密码</Link><form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}><button className="account-signout" type="submit">退出</button></form></div>
      </div>
    </header>
    <div className="workspace-content">{children}</div>
  </div>;
}
