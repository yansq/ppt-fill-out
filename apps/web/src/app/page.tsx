import { Button } from "@report-platform/ui/button";

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
        <p className="mb-3 text-sm font-medium text-primary">REPORT PLATFORM · P1</p>
        <h1 className="text-3xl font-semibold tracking-tight">PPT 协同填报与自动报告生成平台</h1>
        <p className="mt-4 max-w-3xl text-base leading-7">
          工程基线已经建立。下一阶段将实现模板上传、Apache POI 占位符解析、持久化与页面列表展示的首个端到端切片。
        </p>
        <ul className="mt-8 grid gap-3 md:grid-cols-2">
          {foundations.map((item) => (
            <li className="rounded-md border bg-background px-4 py-3 text-sm" key={item}>
              {item}
            </li>
          ))}
        </ul>
        <div className="mt-8">
          <Button type="button">工程状态：P1</Button>
        </div>
      </section>
    </main>
  );
}

