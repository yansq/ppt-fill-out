# 开发进度

> 本文件是项目进度的唯一状态台账。计划详见 `development-plan.md`。每完成一个可验证部分都必须更新本文件。

## 当前摘要

- 当前阶段：`P2 模板解析 Vertical Slice（待开始）`
- 项目状态：`P1_COMPLETE`
- 最近更新：`2026-09-20`
- 下一里程碑：完成上传、存储、POI 解析、持久化和页面/占位符列表展示

## 阶段状态

| 阶段 | 状态 | 完成度 | 验证摘要 |
| --- | --- | ---: | --- |
| P0 设计与工程基线 | 已完成 | 100% | 需求、架构、模型、契约、计划、ADR 和进度台账已落库并完成交叉检查 |
| P1 Monorepo 可启动 | 已完成 | 100% | JS/Java/Prisma 构建与测试通过；双服务本地启动和健康端点已验证；Compose 配置有效 |
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

### 2026-09-20 — P1 / Monorepo 初始化

- [x] 建立 pnpm workspace 和根级开发、检查、测试、构建、Prisma 脚本；通过 ADR-0002 记录暂不使用 Turborepo。
- [x] 创建 Next.js 16 / React 19 / TypeScript / Tailwind CSS 4 Web 应用。
- [x] 创建 Radix/shadcn 风格共享 Button，并启用 `@shadcn/lint` 设计系统规则。
- [x] 创建 Java 17 / Spring Boot 3.5 / Apache POI PPT Service。
- [x] 创建完整 Prisma 初始领域模型和 535 行 MySQL migration。
- [x] 创建 Web/PPT Service Dockerfile、双服务 Compose 和 `report-data:/data` 共享 Volume；MySQL 保持外部连接。
- [x] 创建 `.env.example`，覆盖数据库、Auth、内部服务、存储、加密和 AI 配置。
- [x] 实现 Web liveness/readiness 与 PPT Service Actuator liveness/readiness。
- [x] 更新 README 的本地运行、外部 MySQL、Docker 和验证说明。

验证矩阵：

| 检查 | 结果 |
| --- | --- |
| `pnpm lint` | 通过，0 warnings；包含 ESLint 与 `@shadcn/lint` |
| `DATABASE_URL=... pnpm typecheck` | 通过；shared、ui、web 均通过 |
| `pnpm test:web` | 通过；1 文件、3 tests |
| `mvn -f apps/ppt-service/pom.xml clean package` | BUILD SUCCESS；2 tests，生成可执行 JAR |
| `DATABASE_URL=... pnpm build` | Next.js production build 成功；主页及两个 health route 构建成功 |
| `DATABASE_URL=... pnpm db:validate` | Prisma schema valid |
| Prisma migration 生成 | 成功；`20260920000000_initial/migration.sql`，535 行 |
| Compose v2.39.4 `config --quiet` | 通过 |
| Web liveness | 本地实际请求 HTTP 200 |
| Web readiness（MySQL 未运行） | 本地实际请求 HTTP 503，database check 为 error，符合设计 |
| PPT liveness / readiness | 本地实际请求均为 HTTP 200；共享目录和 LibreOffice 检查通过 |

环境限制：当前 Colima VM 启动后立即退出，Docker daemon 不可连接，因此本轮无法执行容器镜像构建、Compose `up` 或在临时 MySQL 上实际执行 migration。Compose 语义配置已由官方 Compose 二进制验证；宿主机构建、服务启动和健康检查均已实测。进入部署环境或 P2 集成前必须补做容器构建与空库 migration 验证。

## 进行中

- 当前没有代码开发工作进行中；下一次开发从 P2 模板解析 Vertical Slice 开始。

## 下一步

1. 补做 Docker 镜像构建和空 MySQL migration 部署验证。
2. 实现 Collector 模板上传、文件校验、哈希和共享 Volume 原子存储。
3. 实现 `/ppt/parse` 与真实 PPTX fixture，优先验证跨 TextRun 和 Table Cell。
4. 持久化 TemplateSlide/TemplatePlaceholder，并展示页与占位符列表。

## 当前风险与待验证假设

- Apache POI 对跨 TextRun 替换和混合样式的实际行为必须通过真实 PPTX fixture 验证。
- LibreOffice 与 Microsoft PowerPoint 可能存在字体/换行差异；部署镜像需要固定字体集和 LibreOffice 版本。
- Fast Preview 的静态背景生成方式需在 P2 决定：应避免背景中仍显示未替换占位符造成叠字。
- 外部指标库的表结构与写权限尚未给出；P4 需以配置化 query/update mapping 落地并限制 SQL 能力。
- Auth.js 的身份源尚未指定；P3 接入认证时必须明确身份源，且不能绕过服务端授权。
- 当前本机 Colima 无法保持运行；Docker 镜像、Compose 启动及空库 migration 需要在可用 daemon/MySQL 环境补验。

## 更新模板

```text
### YYYY-MM-DD — Px / 工作项
- 结果：
- 变更：
- 验证：精确命令与结果
- 遗留：
- 下一步：
```
