# 开发进度

> 本文件是项目进度的唯一状态台账。计划详见 `development-plan.md`。每完成一个可验证部分都必须更新本文件。

## 当前摘要

- 当前阶段：`P4 指标与填报（待开始）`
- 项目状态：`P3_COMPLETE`
- 最近更新：`2026-09-21`
- 下一里程碑：指标数据源、占位符绑定、Fast Preview 与提交快照

## 阶段状态

| 阶段 | 状态 | 完成度 | 验证摘要 |
| --- | --- | ---: | --- |
| P0 设计与工程基线 | 已完成 | 100% | 需求、架构、模型、契约、计划、ADR 和进度台账已落库并完成交叉检查 |
| P1 Monorepo 可启动 | 已完成 | 100% | JS/Java/Prisma 构建与测试通过；双服务本地启动和健康端点已验证；Compose 配置有效 |
| P2 模板解析 Vertical Slice | 已完成 | 100% | 真实 MySQL migration、PPTX 上传/解析、逐页 PNG、持久化、失败重试、审计及 Compose 持久化均已验证 |
| P3 任务与页面分发 | 已完成 | 100% | 真实登录、ReportTask、同页多人分配、独立 FillInstance、进度、状态与资源授权均通过宿主机和 Compose 集成验证 |
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

### 2026-09-21 — P3 / 身份与授权基线

- [x] 按 ADR-0003 接入 Auth.js Credentials：邮箱/密码登录、8 小时 JWT 会话，无公开注册。
- [x] 新增独立 `UserCredential` 表，随机盐 scrypt 哈希、五次失败锁定 15 分钟；迁移已在真实 MySQL 应用。
- [x] 新增显式 `seed:auth`：已在真实 MySQL 创建 Collector/Filler 角色；只有提供环境变量时才预置用户。
- [x] 每次业务请求从数据库重新确认用户状态和角色；P2 模板接口改为真实会话与资源授权，移除开发身份绕过。
- [x] 补充密码校验、未登录、停用账号、Filler 拒绝 Collector 操作的自动化测试。

验证：`DATABASE_URL=... LIBREOFFICE_EXECUTABLE=... pnpm verify` 全部通过：Web 6 files、16 tests，Java 7 tests，lint/TypeScript/Next build/Java package/Prisma validate 均通过。`migrate:dev` 在真实 MySQL 成功；`seed:auth` 创建角色成功。实际生产服务冒烟：未登录模板 API 返回 401、登录页 200；临时 Collector 凭据登录后模板 API 返回 200；临时 Filler 登录后只能看到 0 个未分配模板，上传返回 403。两名冒烟用户随后从数据库删除。

遗留：尚未实现 ReportTask、页面分配、FillInstance 与进度视图；尚未完成 P3 的资源隔离验收。

### 2026-09-21 — P3 / 任务与页面分发

- [x] Collector 可使用自己 `READY` 的不可变模板版本创建带 `YYYY-MM` 周期的 ReportTask，并写创建审计。
- [x] `PUT /api/report-tasks/{id}/assignments` 以 `expectedVersion` 事务化替换分配集合：验证模板页和活动 Filler，支持同页多人，每条分配创建独立 FillInstance；并发冲突返回 409。
- [x] 未开始且无填报痕迹的分配可撤销；已开始实例不可被静默删除。任务由 `DRAFT` 进入 `FILLING`，Filler 可把自己的实例从 `NOT_STARTED` 迁移至 `IN_PROGRESS`，均有服务端状态校验与审计。
- [x] 新增 Collector 任务列表、创建、页面分配、总体与逐页进度；Filler 我的实例与实例详情页。
- [x] Filler 列表按本人过滤；他人实例 ID 返回 404，Collector 只能访问自己任务；角色被撤销后即时失去相应访问能力。
- [x] 按 ADR-0004 收紧企业内网部署：无公网身份依赖、默认回环地址发布 Web、构建/运行遥测关闭；构建镜像后核心请求只需内网 MySQL/PPT Service。原 HTTPS 入口假设已由 ADR-0006 修订。
- [x] 按 ADR-0005 记录版本化分配与已开始实例保护策略。

验证证据：

- `DATABASE_URL=... AUTH_SECRET=... AUTH_URL=... LIBREOFFICE_EXECUTABLE=... pnpm verify` 通过：lint 0 warnings、TypeScript、Web 7 files/22 tests、Java 7 tests、Next/Java build、Prisma validate 全部成功。
- 真实 MySQL 中已执行 P3 `UserCredential` migration；任务和分配使用既有模型，无新增 P3 任务表迁移。
- `test:p3:smoke` 对本机生产服务和 Compose 容器各通过一次，覆盖任务创建、非法页面/非 Filler 校验、同页两人独立实例、越权 403/404、角色撤销、版本冲突、开始填报、阻止删除已开始实例、进度和页面服务端渲染。脚本已清理临时凭据、用户、任务、分配、实例与审计记录。
- Compose 全量构建成功；Web/PPT Service 均 healthy，Web 映射为 `127.0.0.1:3002->3000`，readiness 与登录页返回 200，未登录任务 API 返回 401；容器内 P3 冒烟通过。
- 当时的 readiness 曾拒绝非本机 HTTP `AUTH_URL`，该限制已由 ADR-0006 撤销；示例认证密钥和缺失内部 API Key 仍被拒绝。容器构建日志不再出现 Next.js 遥测提示。验证容器已停止，`report-data` Volume 保留；临时 P3 测试记录计数归零。
- `docker compose config --quiet` 通过。代码检查未发现核心 Web/PPT 运行时访问公网的 URL；AI 公网地址已从示例配置移除。

遗留：P4 才实现指标绑定、草稿、提交和 SubmittedValue；P5 才实现审核/退回；账户恢复、分布式登录限流及完整断公网交付演练留待 P7。当前 P3 的任务与分发验收已完成，但不等同于整个产品或离线交付完成。

### 2026-09-21 — P3 / 无 HTTPS 内网入口适配

- [x] 按 ADR-0006 允许非本机 HTTP `AUTH_URL`，同时保留 URL 格式、协议、内嵌凭据及认证密钥校验。
- [x] 更新内网部署说明与配置示例，明确 `AUTH_URL` 必须匹配浏览器入口，以及 HTTP 明文传输和网络隔离要求。
- [x] 增加内网 HTTP 成功与非法 URL 拒绝的回归测试。

验证：以非本机 HTTP `AUTH_URL` 执行 `pnpm verify` 全部通过；lint 0 warnings、TypeScript、Web 7 files/25 tests、Java 7 tests、Next/Java build、Prisma validate 均成功。此项未执行实际跨主机 HTTP 登录验收；P7 交付前仍须在目标内网核对入口与访问控制。

### 2026-09-21 — P3 / 用户名凭据登录

- [x] 按 ADR-0007 将登录从邮箱/密码改为用户名/密码；用户名唯一，邮箱可选，现有用户的邮箱已回填为用户名。
- [x] 同步账号预置脚本、任务分配显示、测试与部署文档；默认预置密码仍至少 12 位，隔离测试环境可显式允许 6 位。
- [x] 将用户名迁移应用于本地 `report_platform`；预置本地测试账号 `admin` 为 `COLLECTOR`，密码仅以 scrypt 哈希存储。

验证：`pnpm verify` 全部通过（lint 0 warnings、TypeScript、Web 7 files/25 tests、Java 7 tests、Next/Java build、Prisma validate）；`prisma migrate status` 显示 3 个迁移均已应用。实际 HTTP 登录使用 `admin` 成功取得 302、会话 Cookie 和带用户 ID 的会话；数据库核实 `admin` 无邮箱、具备 `COLLECTOR` 角色。测试账号使用弱密码，只限本地验证，正式使用前必须更换。

### 2026-09-21 — P3 / 本地 PPTX 上传故障排查

- [x] 定位本机上传通用错误：`apps/web/.env.local` 缺少 `STORAGE_ROOT`、`PPT_SERVICE_URL` 和内部 API Key，且 PPT Service 未运行；上传在存储/调用服务前后无法完成。
- [x] 补齐 Git 忽略的本地环境配置，启动使用同一存储根目录和 API Key 的 PPT Service，并补充 README 本机启动说明。
- [x] 使用实际文件 `四车间开发范式1121.pptx` 通过登录后的上传接口完成验证：HTTP 201、模板 `READY`、13 页、13 个预览文件、5 个占位符。

验证：PPTX ZIP 校验通过；PPT Service readiness HTTP 200，Web readiness 为 `ok`；数据库和共享目录中的 13 个预览文件均存在。此为本地运行配置修复，未更改 PPT 解析逻辑。

### 2026-09-21 — P3 / 中文预览字体修复

- [x] 根据用户截图复现：本机 LibreOffice 导出的 PDF 缺失中文字符，字体回退到不含中文的字体；PDFBox 同时报告缺失字形。PPTX XML 和 PDF 文本提取仍保留原文字，问题不在上传或占位符解析。
- [x] 用已包含 `fonts-noto-cjk` 的 Linux PPT Service 镜像对同一 PPTX 重新渲染，核对封面与第二页中文均可见；本机原生 LibreOffice 配置系统 Fontconfig 后也可显示中文。
- [x] 将本地解析服务切换为挂载同一 `data` 目录的 Linux 容器；重新生成 13 页预览并在数据库事务中更新预览路径、哈希和大小，保留旧图片以备回退，写入修复审计。
- [x] README 补充本机镜像启动命令及原生 macOS Fontconfig 说明。

验证：新镜像 `/ppt/render` 返回 13 页；人工查看第 1、2、13 页的中文标题与正文正常。经登录访问的第 1、2 页预览接口均返回 HTTP 200，响应字节 SHA-256 与新数据库记录和 ETag 一致。原始模板文件、5 个占位符和任务数据未改动；浏览器原有缓存可能需要强制刷新。未来多字体模板仍需与企业目标环境的实际字体清单比对。

### 2026-09-21 — P3 / 本地填报人测试账号

- [x] 在本地数据库创建 `aaa`、`bbb`、`ccc` 三个独立的活动账号，均授予 `FILLER` 角色；未覆盖已有用户，密码只保存 scrypt 哈希。
- [x] 三个账号分别通过实际用户名密码登录，均取得会话；弱测试密码只可用于隔离开发环境，正式部署必须重置。

验证：数据库核查 3 个账号的状态、角色、哈希；三个登录请求均返回 HTTP 302，随后会话接口返回对应用户名。

## 进行中

- 当前无进行中的开发项；P4 可从数据源连接与绑定模型开始。

## 下一步

1. 明确企业内网指标库的连接方式、表结构、只读/可写权限与查询映射。
2. 实现 MetricDataSource 抽象和 MySQL Adapter，保持系统库与指标库边界。
3. 实现占位符绑定、手工草稿、报告周期与查看周期分离、Fast Preview。
4. 实现提交事务和不可变 SubmittedValue 快照，并验证越权与并发保护。

## 当前风险与待验证假设

- LibreOffice 与 Microsoft PowerPoint 可能存在字体/换行差异；部署镜像需要固定字体集和 LibreOffice 版本。
- Fast Preview 的静态背景当前保留模板占位符文字；P4 实现字段覆盖层时需避免重复叠字。
- 外部指标库的表结构与写权限尚未给出；P4 需以配置化 query/update mapping 落地并限制 SQL 能力。
- 当前采用内置凭据身份源；若改接企业 OAuth/OIDC，应保持业务 User ID 与资源授权逻辑不变，并单独设计账户映射。
- JWT 仅承载用户 ID，角色和停用状态由每次业务请求实时查询；正式大规模部署前仍需分布式登录限流、账户恢复与登录审计。
- 企业内网部署还需由受控 CI/内部镜像仓库或镜像归档提供依赖；P7 前必须进行断公网启动、内网 HTTP/HTTPS 入口与代理访问控制、备份恢复演练。

## 更新模板

```text
### YYYY-MM-DD — Px / 工作项
- 结果：
- 变更：
- 验证：精确命令与结果
- 遗留：
- 下一步：
```
