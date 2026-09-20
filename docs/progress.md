# 开发进度

> 本文件是项目进度的唯一状态台账。计划详见 `development-plan.md`。每完成一个可验证部分都必须更新本文件。

## 当前摘要

- 当前阶段：`P1 Monorepo 可启动（待开始）`
- 项目状态：`READY_FOR_IMPLEMENTATION`
- 最近更新：`2026-09-20`
- 下一里程碑：确认工程基线后开始 `P1 Monorepo 可启动`

## 阶段状态

| 阶段 | 状态 | 完成度 | 验证摘要 |
|---|---|---:|---|
| P0 设计与工程基线 | 已完成 | 100% | 需求、架构、模型、契约、计划、ADR 和进度台账已落库并完成交叉检查 |
| P1 Monorepo 可启动 | 待办 | 0% | 尚未初始化代码 |
| P2 模板解析 Vertical Slice | 待办 | 0% | 尚未开始 |
| P3 任务与页面分发 | 待办 | 0% | 尚未开始 |
| P4 指标与填报 | 待办 | 0% | 尚未开始 |
| P5 审核与 FinalValue | 待办 | 0% | 尚未开始 |
| P6 生成与真实预览 | 待办 | 0% | 尚未开始 |
| P7 AI、加固与交付 | 待办 | 0% | 尚未开始 |

## 已完成

### 2026-09-20

- [x] 读取并梳理原始需求。
- [x] 固化产品范围、角色、术语、三级 Value、状态机、MVP 与非目标。
- [x] 固化 Web/PPT Service/系统库/指标源/文件存储的边界与数据流。
- [x] 给出 Prisma 初始实体、关系、唯一约束、索引方向与乐观锁策略。
- [x] 给出 Web、PPT Service 和 MetricDataSource 的接口契约草案。
- [x] 建立 P0-P7 开发计划、阶段验收标准和统一 Definition of Done。
- [x] 创建首份 ADR，记录初始架构决策。

验证证据：文档交叉检查完成；当前仓库在本次工作前为空，本阶段未声称存在可运行代码、构建或测试。

## 进行中

- 当前没有代码开发工作进行中；下一次开发从 P1 的工程初始化开始。

## 下一步

1. 初始化 pnpm monorepo 与根级脚本。
2. 创建 Next.js Web 和 Spring Boot PPT Service。
3. 创建 Prisma 初始 schema、`.env.example`、Compose 与共享 Volume。
4. 实现并验证两个服务的 health check。
5. 记录所有实际版本、命令和构建证据，再关闭 P1。

## 当前风险与待验证假设

- Apache POI 对跨 TextRun 替换和混合样式的实际行为必须通过真实 PPTX fixture 验证。
- LibreOffice 与 Microsoft PowerPoint 可能存在字体/换行差异；部署镜像需要固定字体集和 LibreOffice 版本。
- Fast Preview 的静态背景生成方式需在 P2 决定：应避免背景中仍显示未替换占位符造成叠字。
- 外部指标库的表结构与写权限尚未给出；P4 需以配置化 query/update mapping 落地并限制 SQL 能力。
- Auth.js 的身份源尚未指定；P1 可先使用可替换的开发认证配置，但不能绕过服务端授权。

## 更新模板

```text
### YYYY-MM-DD — Px / 工作项
- 结果：
- 变更：
- 验证：精确命令与结果
- 遗留：
- 下一步：
```
