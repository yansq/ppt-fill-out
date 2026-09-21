# 开发进度

> 本文件是项目进度的唯一状态台账。计划详见 `development-plan.md`。每完成一个可验证部分都必须更新本文件。

## 当前摘要

- 当前阶段：`P3 任务与页面分发（待开始）`
- 项目状态：`P2_COMPLETE`
- 最近更新：`2026-09-21`
- 下一里程碑：接入 Auth.js，并实现 ReportTask、页面分配与 FillInstance

## 阶段状态

| 阶段 | 状态 | 完成度 | 验证摘要 |
| --- | --- | ---: | --- |
| P0 设计与工程基线 | 已完成 | 100% | 需求、架构、模型、契约、计划、ADR 和进度台账已落库并完成交叉检查 |
| P1 Monorepo 可启动 | 已完成 | 100% | JS/Java/Prisma 构建与测试通过；双服务本地启动和健康端点已验证；Compose 配置有效 |
| P2 模板解析 Vertical Slice | 已完成 | 100% | 真实 MySQL migration、PPTX 上传/解析、逐页 PNG、持久化、失败重试、审计及 Compose 持久化均已验证 |
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

当时的环境限制：Colima VM 启动后立即退出，因此 P1 未执行容器镜像构建、Compose `up` 和真实 migration。该限制已在 2026-09-21 的 P2 验证中解除并补验。

### 2026-09-21 — P2 / 模板解析基础链路

- [x] PPT Service 新增受内部 API Key 保护的 `POST /ppt/parse`。
- [x] 限制解析路径只能位于 `/data/templates`，并在打开 PPTX 前校验 SHA-256。
- [x] 基于逻辑段落全文与字符到 TextRun 的映射识别单 Run、跨 Run和同段多个 Placeholder。
- [x] 支持 Table Cell Placeholder、每个 key 独立 occurrence 序号、shape/cell geometry 和起始 Run 样式快照。
- [x] 使用 Apache POI 动态生成真实 PPTX fixture，覆盖中文、混合样式、跨 Run、重复 key、表格、无占位符页面、路径逃逸和哈希不一致。
- [x] Web 新增 PPTX ZIP 安全校验、扩展名/MIME/大小校验、临时目录写入和原子移动。
- [x] Web 新增 PPT Service 类型化客户端、模板/页面/占位符 Prisma 事务持久化、失败状态与上传审计。
- [x] 新增模板上传和页/占位符列表页面；P2 本地身份仅在非生产环境显式配置后启用，生产环境拒绝绕过。
- [x] PPT Service 新增 `POST /ppt/render`：LibreOffice 无头转换 PDF，PDFBox 以 144 DPI 逐页生成 PNG，并在失败时清理临时与已移动文件。
- [x] Web 保存 `StoredFile(PREVIEW)` 并关联 `TemplateSlide.previewFileId`，通过受保护路由读取缩略图。
- [x] 新增解析失败重试及 `TEMPLATE_PARSE_FAILED`、`TEMPLATE_PARSE_RETRY`、`TEMPLATE_PARSE_SUCCEEDED` 审计事件。
- [x] 在用户提供的 MySQL 上创建 `report_platform` 数据库并部署初始 migration。
- [x] 完成宿主机与 Compose 真实 PPTX 端到端验证；容器重启后模板和缩略图仍可读取。

验证：

- `DATABASE_URL=... LIBREOFFICE_EXECUTABLE=... pnpm verify`：通过；串行覆盖 lint、TypeScript、Web/Java tests、Next/Java build 和 Prisma validate。
- `mvn -f apps/ppt-service/pom.xml clean package`：BUILD SUCCESS，7 tests；宿主机 LibreOffice 实际生成两页 PNG。
- `pnpm test:web`：4 files、9 tests 全部通过。
- `DATABASE_URL=... pnpm typecheck`：通过。
- `pnpm lint`：通过，0 warnings。
- `DATABASE_URL=... pnpm build`：Next.js production build 通过，P2 动态页面与 API 路由构建成功。
- Prisma migration 已在真实 MySQL 空库成功部署；数据库中模板、页面、Placeholder、预览文件与审计记录关联正确。
- 运行中的 Web + PPT Service 完成 multipart 上传；成功模板为 `READY`，两页预览均返回 HTTP 200。
- 停止 PPT Service 后上传得到 `PARSE_FAILED`；恢复服务后重试变为 `READY`，再次重试正确返回 HTTP 409。
- Compose 全量镜像构建成功，Web/PPT Service 均为 healthy；重启后预览仍返回 HTTP 200，证明 `report-data` Volume 持久化有效。
- 浏览器人工检查模板列表、解析状态、Placeholder 信息与两页缩略图布局；容器内 Noto CJK 字体可正确渲染中文。
- 生产模式未显式开启临时身份绕过时，模板服务拒绝请求；对应回归测试通过。

遗留：P2 的临时身份只允许本地隔离验证；真实登录、租户上下文和资源级授权按计划在 P3 通过 Auth.js 落地。

## 进行中

- 当前无进行中的开发项；P3 可在 P2 提交后启动。

## 下一步

1. 确认 Auth.js 身份源，建立服务端 session、tenant 上下文和资源授权基线。
2. 实现 ReportTask 创建、模板快照和任务状态机。
3. 实现按页分配 Filler，并事务化创建 PageAssignment 与 FillInstance。
4. 增加任务列表、任务详情、页面分配和填报进度视图。

## 当前风险与待验证假设

- LibreOffice 与 Microsoft PowerPoint 可能存在字体/换行差异；部署镜像需要固定字体集和 LibreOffice 版本。
- Fast Preview 的静态背景当前保留模板占位符文字；P4 实现字段覆盖层时需避免重复叠字。
- 外部指标库的表结构与写权限尚未给出；P4 需以配置化 query/update mapping 落地并限制 SQL 能力。
- Auth.js 的身份源尚未指定；P3 接入认证时必须明确身份源，且不能绕过服务端授权。

## 更新模板

```text
### YYYY-MM-DD — Px / 工作项
- 结果：
- 变更：
- 验证：精确命令与结果
- 遗留：
- 下一步：
```
