# ADR-0002：P1 使用 pnpm workspace，不引入 Turborepo

- 状态：Accepted
- 日期：2026-09-20

## 背景

P1 只有一个 JavaScript 应用、一个 Prisma 包和两个轻量共享包。Java PPT Service 使用 Maven 独立构建。当前构建图简单，尚不需要远程缓存或复杂任务依赖编排。

## 决策

使用 pnpm workspace 管理 JavaScript/TypeScript 包，由根级脚本通过 pnpm filter 和 recursive 命令执行生成、检查、测试与构建。暂不引入 Turborepo。

## 结果

依赖和脚本数量更少，开发与容器构建路径更直接。若后续包数量、构建耗时或 CI 并行需求明显增长，可新增 Turborepo；该变化不影响现有包边界和脚本职责。

