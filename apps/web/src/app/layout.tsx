import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "PPT 协同填报平台",
  description: "基于 PPT 模板的协同填报与自动报告生成平台"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

