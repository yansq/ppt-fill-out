import { Button } from "@report-platform/ui/button";
import Link from "next/link";

const foundations = [
  "Next.js Web 与领域化目录",
  "Prisma + 外部 MySQL 配置",
  "Spring Boot PPT Service",
  "共享 /data 文件卷",
  "双服务存活与就绪检查"
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-8 py-16">
      <section className="rounded-lg border bg-card p-8 text-card-foreground shadow-sm">
        <p className="mb-3 text-sm font-medium text-primary">REPORT PLATFORM · P3</p>
        <h1 className="text-3xl font-semibold tracking-tight">PPT 协同填报与自动报告生成平台</h1>
        <p className="mt-4 max-w-3xl text-base leading-7">
          模板解析链路已经建立；现已接入登录与模板资源授权，正在建设任务与页面分发。
        </p>
        <ul className="mt-8 grid gap-3 md:grid-cols-2">
          {foundations.map((item) => (
            <li className="rounded-md border bg-background px-4 py-3 text-sm" key={item}>
              {item}
            </li>
          ))}
        </ul>
        <div className="mt-8 flex items-center gap-3">
          <Button asChild>
            <Link href="/templates">进入模板管理</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/report-tasks">报告任务</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/my-tasks">我的填报</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/api/auth/signin">登录</Link>
          </Button>
          <span className="text-sm">当前阶段：P3</span>
        </div>
      </section>
    </main>
  );
}
