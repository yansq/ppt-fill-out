# 开发进度

> 本文件是项目进度的唯一状态台账。计划详见 `development-plan.md`。每完成一个可验证部分都必须更新本文件。

## 当前摘要

- 当前阶段：`P6 生成与真实预览（进行中）`
- 项目状态：`P6_IN_PROGRESS`
- 最近更新：`2026-09-23`
- 下一里程碑：P6 浏览器交互和目标字体版式回归；目标内网部署演练与企业真实指标映射

## 阶段状态

| 阶段 | 状态 | 完成度 | 验证摘要 |
| --- | --- | ---: | --- |
| P0 设计与工程基线 | 已完成 | 100% | 需求、架构、模型、契约、计划、ADR 和进度台账已落库并完成交叉检查 |
| P1 Monorepo 可启动 | 已完成 | 100% | JS/Java/Prisma 构建与测试通过；双服务本地启动和健康端点已验证；Compose 配置有效 |
| P2 模板解析 Vertical Slice | 已完成 | 100% | 真实 MySQL migration、PPTX 上传/解析、逐页 PNG、持久化、失败重试、审计及 Compose 持久化均已验证 |
| P3 任务与页面分发 | 已完成 | 100% | 真实登录、ReportTask、同页多人分配、独立 FillInstance、进度、状态与资源授权均通过宿主机和 Compose 集成验证 |
| P4 指标与填报 | 示例主链路已完成；企业适配待办 | 95% | 独立示例指标库、查询/修改/历史、绑定、人工草稿、PPT 原位草稿预览、提交快照及平台镜像补偿已通过真实账号冒烟；真实企业映射待接入，Compose 复验按要求后置 |
| P5 审核与 FinalValue | 进行中 | 85% | 多人最新 revision 聚合、一致/冲突/缺失、显式最终值、退回重提、乐观锁及完整性检查通过真实账号冒烟；浏览器交互与容器复验未完成 |
| P6 生成与真实预览 | 进行中 | 85% | FinalValue 完整快照、PPTX/PDF/逐页 PNG、受控预览下载、幂等和审计已通过真实账号冒烟；浏览器交互及目标环境版式/容器复验待办 |
| P7 AI、加固与交付 | 进行中 | 20% | amd64 离线部署包与本机测试数据已制作并在临时 MySQL 中验证导入；目标内网部署和其余加固待办 |

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

### 2026-09-21 — P4 / MySQL 指标源配置基础链路

- [x] 按 ADR-0008 建立独立 `MetricDataSource` / MySQL Adapter 的连接测试边界，不通过系统 Prisma Client 连接指标库。
- [x] Collector 可在 `/data-sources` 创建 MySQL 数据源、查看不含密码的配置与执行连接测试；Filler 无权访问 API 和页面。
- [x] 密码以随机 nonce 的 AES-256-GCM 加密持久化，密钥由环境变量注入，缺失/错误时拒绝保存；API 与审计只返回非敏感字段。
- [x] 连接探测设置 5 秒超时，成功或失败写入无凭据审计；数据库驱动错误不返回浏览器。

验证：`pnpm verify` 通过（ESLint/@shadcn lint、TypeScript、Web 10 文件/31 tests、Java 7 tests、Next/Java build、Prisma validate）；新增服务边界测试后 `pnpm test:web` 为 11 文件/34 tests，`pnpm typecheck` 与 `pnpm lint` 再次通过。MySQL 驱动对本机数据库执行 `SELECT 1` 成功，证明基础连接可用；尚未拿到独立企业指标库及映射，未验证实际指标查询。当前机器 `docker compose` 插件不可用，因此本切片的 Compose config/镜像构建未复验；P3 记录的 Compose 验证不代表本次新依赖镜像已验证。

### 2026-09-21 — P4 / 独立示例指标库与完整填报主链路

- [x] 按 ADR-0009 创建独立 `report_metrics_demo.metric_record` 和 `metric_record_change`；前者包含数据源编码、指标编码/名称、值/类型/单位、`YYYY-MM`、创建/更新时间、更新人和版本。幂等初始化 3 个指标 × 4 个月份，平台注册加密数据源与 3 个指标定义。
- [x] 初始化本地 `P4 示例填报任务`，使用已上传模板的两占位符页面并分配给 `aaa`，可从界面继续测试。`report_platform` 新增 Binding 来源快照列的 migration 已真实部署。
- [x] 受实例权限保护的月份指标查询、独立 `viewPeriod` 与醒目跨月提示；保存 DATABASE_METRIC 或 MANUAL_TEXT 草稿时使用实例版本锁，并固定指标实际 period 与来源值快照。
- [x] 快速预览在模板 PNG 上遮盖已绑定占位符区域并叠加 DOM 文本；它是近似编辑反馈，尚非真正去字静态背景。
- [x] 提交事务要求本页所有占位符已绑定，生成每个占位符不可变 SubmittedValue，保护版本/状态；最后一个实例提交后任务进入 REVIEWING。
- [x] Collector 可按月修改示例指标，必须提供原因与源库版本；外部指标表与同库修改历史原子更新，平台缓存/历史/操作审计随后同步。源库成功而平台同步失败时明确返回待同步，不宣称整体成功。

验证：真实本机 MySQL 创建示例 schema、12 条指标记录与平台注册数据，核对测试表的全部 12 列。`pnpm verify` 全部通过：lint 0 warnings、TypeScript、Web 12 文件/38 tests、Java 7 tests、Next/Java build 和 Prisma validate。`test:p4:smoke` 在本机生产 Web 和重新载入环境的 3000 端口开发 Web 上均通过 `admin`、`aaa`、`bbb` 实际登录，覆盖他人实例 404、历史月份与报告月份分离、绑定过期版本 409、人工/指标双来源提交、SubmittedValue 在源值更新后不变、指标修改原因/历史和源库并发版本 409；数据源页、指标页和填报页服务端渲染返回 200。冒烟临时任务已清理，指标示例值已恢复；示例任务保留供手工操作。Compose 插件仍不可用，容器内新链路未验证；未做浏览器视觉回归。

### 2026-09-22 — P4 / 示例链路收尾与 P5 启动

- [x] 提交此前的 P4 示例指标和填报主链路，提交 `9ad0f68`。
- [x] 按 ADR-0010，在不可变 PPTX 临时副本中跨 TextRun 移除 `{{key}}`，渲染真正去字的静态 PNG；Web 填报预览改为静态背景 + DOM 动态值，保留原模板和普通缩略图。
- [x] 指标源库变更历史用于补偿平台镜像；Collector 可显式对账，连续版本逐条恢复，缺口拒绝伪造历史；重复对账幂等。
- [x] 按 ADR-0011 实现 P5 同页多人最新提交聚合、一致/冲突/缺失标识、选提交或手工确定 FinalValue、退回重提 revision、任务版本锁及完成审核时的 FinalValue 完整性检查。退回使同页已有最终值失效并留审计。
- [x] 任务详情页加入审核面板，可逐项确定最终值、退回实例及完成审核。

验证：`pnpm verify` 全部通过：ESLint/@shadcn lint 0 warnings、TypeScript、Web 14 文件/43 tests、Java 9 tests、Next.js production build、Java package、Prisma validate。P4 本机真实账号冒烟覆盖去字图片授权、指标源修改、人工回退平台镜像版本后的变更历史补偿和幂等同步、快照不可变；P5 本机真实账号冒烟覆盖两人冲突、角色拒绝、旧版本 409、退回清除同页 FinalValue、下一 revision 后一致、手工 FinalValue 与完整性完成。实际用户 PPTX 第 2 页去字 PNG 人工查看：固定中文、Logo 保留，动态标记已移除；原模板哈希不变。

遗留：企业真实指标库的表结构、权限及受控映射尚未提供，示例 Adapter 不能直接上线；Compose/PPT 镜像复验按用户要求留到后期。P5 尚未做浏览器交互视觉回归，也未在企业内网多用户环境验证。Web/PPT Service 当前本机开发进程已用于上述冒烟，不等于可交付部署。

### 2026-09-22 — P4 / 草稿预览错位修复

- [x] 根据用户截图与实际模板数据库记录确认：`accuracy` 位于 shape 55 的第 3 段，原几何是整个长文本框而非字符位置；用该 anchor 定位 DOM 动态层导致错位。
- [x] 按 ADR-0012 将草稿预览改为 PPT Service 在临时 PPTX 的原 TextRun 位置替换已保存值并渲染单页 PNG。支持跨 Run、同 key 多 occurrence 和表格；原模板文件不修改。
- [x] Web 使用带 FillInstance 版本的私有草稿预览接口；保存绑定后更新图片 URL，移除旧 DOM 几何叠加层。他人访问 404，过期版本 409。

验证：`pnpm verify` 全部通过：ESLint/@shadcn lint、TypeScript、Web 14 文件/44 tests、Java 12 tests、Next.js build、Java package 和 Prisma validate。实际用户 PPTX 第 3 页经新接口生成 1920×1080 PNG，人工检查 `12` 和 `1422.10` 均在原句占位符位置，固定元素保留。P4 本机真实账号冒烟通过草稿图片 HTTP 200、他人 404、旧版本 409；Web 和 PPT Service 本机 readiness 均正常。

遗留：草稿每次保存后需重新进行 LibreOffice 转换；这是页面编辑反馈，P6 的最终报告预览与导出尚未实现。

### 2026-09-22 — P6 / 最终报告生成与真实预览主链路

- [x] 将 P5 完成审核的完整性范围收紧到模板全部占位符：未分配页也需 Collector 手工确定 FinalValue；原有同页多人提交/退回规则保持不变。
- [x] Collector 仅能对自己已完成审核的任务生成报告；Web 以任务版本、模板哈希、FinalValue 文本及来源版本创建不可变生成快照，UUID 幂等键防止重试重复生成。
- [x] PPT Service 校验原模板 SHA-256 和全部 `(slideIndex,key,occurrenceIndex)`，在临时副本原 TextRun 位置填值，生成完整 PPTX、PDF 与逐页 144 DPI PNG；原模板不被覆盖。初步版式告警仅提示相对原模板新增的疑似溢出。
- [x] Web 持久化生成文件哈希/大小、快照及操作日志；任务详情页显示逐页真实预览和版式提示。下载前校验任务归属、文件哈希和大小；显式导出 PPTX/PDF 时写审计并转为 `EXPORTED`。
- [x] 新增 P6 集成冒烟脚本，覆盖全 13 页、FinalValue 快照、文件格式/哈希、幂等、Filler 拒绝、导出审计及原模板哈希不变。

验证：真实账号 `test:p5:smoke`、`test:p6:smoke` 通过，P6 报告产生 13 页 PPTX/PDF/PNG。使用用户提供的 13 页 PPTX 再次独立生成并人工查看第 1–6、9、13 页的预览；第 2–5 页动态值出现在原占位符位置，固定 Logo、标题、表格和图形保留。载入本地环境后完整 `pnpm verify` 通过：lint 0 warnings、TypeScript、Web 15 文件/47 tests、Java 14 tests、Next.js/Java build、Prisma validate 均成功。未新增数据库迁移。独立生成验证产生的 15 个临时文件已清理，原模板和正式任务数据未删除。

遗留：尚未在浏览器完整点验生成按钮、逐页查看、下载与异常提示，也未以企业目标 PowerPoint/固定字体集逐页比对所有版式。Compose/断公网复验按用户要求后置；当前示例库不能代表企业真实指标库。P6 因此仍标记进行中。

### 2026-09-22 — 前端工作台与任务流程重设计

- [x] 用按角色展示的工作台替换开发阶段首页，明确“准备模板、分配填报、审核内容、生成报告”的完整流程，并突出当前待办。
- [x] 统一导航与页面视觉结构；任务列表、填报列表按待处理状态组织，任务详情提供步骤导航和当前操作提示。
- [x] 增加中文账号登录页和退出入口，替换默认英文登录说明；页面状态及主要用户文案改为中文，并在审核操作后刷新任务与生成状态。

验证：`pnpm lint`、`pnpm typecheck`、Web 47 项测试、Java 14 项测试、Next.js 构建、Java 打包均通过；加载本地数据库配置后的 `pnpm db:validate` 通过。浏览器已检查中文登录页及窄屏布局。当前未取得可用于本轮交互验证的账号凭据，登录后工作台及任务详情的浏览器视觉点验仍待补充；原有业务 API 与权限边界未调整。

### 2026-09-22 — 按页分配体验改进

- [x] 分配卡片直接展示对应 PPT 页缩略图，并可打开大图核对页面内容。
- [x] 填报人选择改为按页展开、按姓名或用户名搜索；已选人员以标签显示，可单独移除。
- [x] 无占位符页显示“无需分配”，不提供选择控件；保存时排除这类页面，服务端拒绝向其新增分配。既有已开始填报的分配仍遵守不可撤销规则。
- [x] 分配卡片将页码与填写提示排在同一行，并收紧标题区域高度；空间不足时自动换行。

验证：载入本地环境执行 `pnpm verify` 全部通过，包含 lint、TypeScript、Web 16 文件/48 项测试、Java 14 项测试、Next.js/Java 构建及 Prisma 校验。新增交互测试覆盖预览链接、搜索过滤、选择和无占位符页不进入保存请求。使用实际 13 页模板在浏览器核对：4 页可分配，其余显示“无需分配”；搜索用户名、选择后人数和标签均正确更新。用于核对的临时账号和任务已删除。

页头紧凑布局调整后，`pnpm lint`、`pnpm typecheck`、Web 生产构建及 `git diff --check` 均通过。

### 2026-09-22 — 填报页面连续导航

- [x] “上一项”“下一项”按 PPT 页码切换到同一任务中当前填报人负责的相邻页面；无分配页不会进入导航序列，首末页禁用对应按钮。
- [x] 每页保留全部占位符的填写表单；切换前提示未保存修改，保存进行中禁用切换，未保存修改不能直接提交本页。

验证：新增交互测试覆盖相邻页面链接、首末页边界和未保存修改的离开确认；`pnpm lint`、`pnpm typecheck`、Web 17 文件/50 项测试、`pnpm build`、载入本地数据库配置后的 `pnpm db:validate` 及 `git diff --check` 均通过。

### 2026-09-22 — 完成全部分配页后的填报提示

- [x] 提交页面时在事务内检查当前填报人对同一报告任务是否还有未提交页面，并将完成结果随提交响应返回。
- [x] 最后一页提交成功后弹出“已完成填报”，提供“返回工作台”按钮；其他页面仍待填写时维持普通提交反馈。

验证：新增交互测试覆盖最后一页与仍有待填页两种提交结果；`pnpm lint`、`pnpm typecheck`、Web 18 文件/52 项测试、Next.js 构建、Java 14 项测试及打包、载入本地数据库配置后的 Prisma 校验均通过。

### 2026-09-22 — 填报人工作台按报告展示

- [x] 工作台将当前填报人的页面按报告任务 ID 合并，每份报告显示一条，标明需填报总页数与已提交页数；已完成的报告仍可从工作台查看。
- [x] 报告入口优先打开退回页，其次是填写中的页面，再按 PPT 页码打开待开始页；已完成报告打开其第一页。

验证：新增汇总测试覆盖同一报告多页、同名不同报告、退回页优先和已完成报告；载入本地环境执行 `pnpm verify` 全部通过，含 lint、TypeScript、Web 19 文件/53 项测试、Java 14 项测试、Next.js/Java 构建及 Prisma 校验。

### 2026-09-22 — 我的填报与 PPT 页面切换重构

- [x] “我的填报”列表按报告任务 ID 汇总，一份报告只显示一条，分别列出需填报页数与已提交页数；待处理与已完成报告各自只出现一次。
- [x] 填报页改为页面缩略图、宽幅 PPT 预览、填写控件的布局；窄屏时顺序排列。缩略图展示当前填报人负责的 PPT 页面与状态，点击切换，保留上一项/下一项和未保存修改提示。
- [x] 指标明细收起显示，减少填写控件被挤到页面下方的情况；无编辑权限的预览页采用相同的大图布局。

验证：页面导航交互测试覆盖缩略图预览、页码跳转、首末项禁用及未保存修改确认；载入本地环境执行 `pnpm verify` 全部通过，含 lint、TypeScript、Web 19 文件/53 项测试、Java 14 项测试、Next.js/Java 构建及 Prisma 校验。最终文案和折叠区域调整后再次执行 Web 检查。

### 2026-09-22 — 填报预览加载优化

- [x] PPT Service 临时草稿和静态预览仅保留目标幻灯片再交给 LibreOffice 转换，避免为单页预览转换整份报告；预览仍从原模板副本生成，不改动模板。
- [x] Web 对已授权、版本一致的草稿预览做进程内限量缓存及同版本并发合并，版本变化会重新渲染，失败结果不缓存；浏览器响应仍禁用共享缓存。
- [x] 大图加载时先显示模板原图和动态“正在渲染页面预览”提示，完成后切换草稿，失败时给出中文说明；主预览提高加载优先级，缩略图降低优先级。

验证：新增缓存复用、版本更新、失败重试和加载状态测试；载入本地环境执行 `pnpm verify` 全部通过，含 lint、TypeScript、Web 21 文件/57 项测试、Java 14 项测试（含非首页临时预览）、Next.js/Java 构建及 Prisma 校验。

### 2026-09-22 — 填报项定位到 PPT 占位符

- [x] 每个填报项增加“定位到 PPT”按钮，按已有占位符几何坐标在预览上标出对应区域；可切换定位目标，再次点击可取消高亮。
- [x] 预览按模板实际页面比例展示，使坐标与图片对齐；窄屏预览不在视野内时自动滚动到预览。

验证：新增交互测试覆盖定位、切换和取消高亮；载入本地环境执行 `pnpm verify` 全部通过，含 lint、TypeScript、Web 21 文件/58 项测试、Java 14 项测试、Next.js/Java 构建及 Prisma 校验。

### 2026-09-22 — 缩小填报项高亮范围

- [x] 修正按整个 PPT 文本框画高亮导致范围过大的问题；PPT Service 从原模板单页 PDF 中提取占位符文字的实际边界，Web 在用户点击定位时按文字边界显示小范围标记。
- [x] 同名占位符优先根据所属文本框匹配，避免 PPT 绘制顺序与模板占位符顺序不同时标错；定位失败时给出中文说明，不再画覆盖整块内容的框。
- [x] 本机 8081 端口的渲染服务已更新；以用户截图对应的 `{{type}}` 验证，标记约占页面宽 9.4%、高 3.6%。

验证：Java 新增文字边界测试，Web 新增重复键匹配与定位交互测试；完整 `pnpm verify` 通过（Web 21 文件/60 项、Java 15 项）。最后补充的匹配逻辑经 lint、TypeScript、Web 22 文件/61 项测试及 Next.js 构建再次验证；Prisma 校验通过。

### 2026-09-22 — 改用 PPT 原生文字变色标记填报项

- [x] 点击填报项“高亮文字”时，草稿预览只把对应填充值改为洋红色；同一文本框中的其他文字保持原有颜色，再次点击可取消，切换填报项可直接切换标记。
- [x] 尚未填写的选中项在标记预览中显示带颜色的占位符名称，便于识别其位置；正常草稿预览和最终报告不受影响。
- [x] 移除基于 PDF 文字边界和页面坐标绘制的高亮框及对应定位接口。高亮预览按填报实例、版本和选中项分别缓存，并校验选中项属于当前实例。
- [x] 已更新本机 8081 预览服务；使用用户截图对应模板的第 2 页和 `{{type}}` 验证，生成图片中仅 `1422.10` 文字变色。

验证：`pnpm verify` 全部通过，含 lint、TypeScript、Web 21 文件/58 项测试、Java 17 项测试、Next.js/Java 构建和 Prisma 校验；另外通过实际模板调用渲染接口并检查生成图片。

### 2026-09-22 — 系统数据库字段中文注释

- [x] 为 Prisma 中 24 张业务表的 224 个实际数据库字段补充中文说明，并在 Prisma 模型字段上同步保留中文文档注释。Prisma 自身管理的 `_prisma_migrations` 表不在业务表范围内。
- [x] 新增仅修改 MySQL 字段注释的迁移，保留原字段类型、空值约束、默认值和字符集；已应用到本地 `report_platform` 数据库。

验证：在临时空库完整部署全部 5 条迁移，确认 224 个业务字段均有中文注释；`pnpm verify` 全部通过。应用到本地库后再次读取 `information_schema.COLUMNS`，确认 224 个注释齐全，且字段类型、空值约束、默认值及字符集与迁移前一致。

### 2026-09-23 — 6 位工号登录与分发识别

- [x] `User` 新增必填、唯一的 6 位数字工号；迁移为既有用户回填稳定的临时工号，不改变用户 ID 及关联数据。
- [x] Auth.js Credentials 从用户名/密码改为工号/密码，前后端均校验六位数字；密码哈希、失败锁定、会话与授权策略不变。
- [x] `seed:auth` 账号预置增加 `AUTH_SEED_EMPLOYEE_NUMBER`；分发选择、已选标签和逐页进度均展示“姓名（工号）”，并支持按姓名、用户名或工号搜索。
- [x] 新增 ADR-0014，同步领域模型、架构、接口、需求和部署说明；仍保持无公开自助注册。

验证：工号迁移已在本机真实 MySQL 成功应用，5 个既有用户的工号均为唯一六位数字；`seed:auth` 成功预置带 FILLER 角色和密码凭据的六位工号测试账号，核对后已删除该临时用户。`pnpm verify` 全部通过：lint 0 warnings、TypeScript、Web 21 文件/58 项测试、Java 17 项测试、Next.js/Java 构建和 Prisma 校验。

### 2026-09-23 — 填报页指标区域与跨页复用

- [x] 将“引用数据库指标”移到 PPT 页面预览的正下方，填写内容保持在右侧栏。
- [x] 按报告任务和查看月份在当前浏览器标签页缓存已加载指标；切换到同一报告的其他填报页时自动恢复月份和指标，不再重复请求，仍可用“加载该月指标”主动刷新。
- [x] 会话存储不可用或内容异常时自动回退到原有手动加载流程，不影响填报与保存。

验证：新增交互测试确认区域 DOM 顺序及同任务另一页挂载时直接恢复指标、网络请求仍只发生一次。`pnpm verify` 全部通过：lint 0 warnings、TypeScript、Web 21 文件/60 项测试、Java 17 项测试、Next.js/Java 构建和 Prisma 校验。

### 2026-09-23 — 顶部账号标识增加工号

- [x] 工作台所有页面的右上角账号统一显示为“用户名(工号)”，工号从当前已认证用户的服务端资料读取。

验证：新增当前操作人工号返回测试；`pnpm verify` 全部通过：lint 0 warnings、TypeScript、Web 21 文件/61 项测试、Java 17 项测试、Next.js/Java 构建和 Prisma 校验。

### 2026-09-23 — 审核页改为 PPT 主体布局

- [x] 审核工作区与填报页统一为三栏布局：左侧缩略图导航、中间 PPT 页面主预览、右侧当前页审核内容；审核阶段的任务详情同步使用宽屏容器。
- [x] 左侧每个缩略图展示页码和已确认数，切换时只更新中间预览及右侧当前页提交值、冲突、退回与最终值操作。
- [x] 审核服务返回每页的受权预览地址和实际页面宽高比，无预览文件时显示空状态，不影响审核操作。

验证：新增审核布局交互测试，覆盖三栏工作区、缩略图导航、主预览和当前页审核内容联动。`pnpm verify` 全部通过：lint 0 warnings、TypeScript、Web 22 文件/62 项测试、Java 17 项测试、Next.js/Java 构建和 Prisma 校验。

### 2026-09-23 — 逐页状态合并到审核工作区

- [x] 移除任务详情中独立的“逐页进度”卡片，将模板全部页面放入审核工作区的缩略图导航；无占位符的页面也可查看。
- [x] 每页展示无需填报、待分配、填报中、已退回、待审核或审核完成状态，并显示已分配填报人的姓名和工号；填报前与审核完成后都可查看同一工作区。
- [x] 保留总体提交进度和原有审核操作，任务步骤入口合并为“页面状态与审核”。

验证：审核导航交互测试覆盖无填报页、填报中、待审核及审核完成状态；`pnpm lint`、`pnpm typecheck`、Web 22 文件/63 项测试、Java 17 项测试、Next.js/Java 构建与 Prisma 校验通过。

### 2026-09-23 — 审核后进入独立生成导出页

- [x] 审核区在审核未完成时显示不可用的“生成与导出”入口；完成审核后显示完成标识及可用入口，保存提示明确指向下一步。已导出任务重新打开时仍可进入。
- [x] 新增报告任务的独立生成导出页面，复用受权生成、真实预览和下载面板；未完成审核的任务返回审核页，页面提供返回审核入口。
- [x] 任务步骤链接指向独立页面，移除任务详情底部重复的生成导出区域。

验证：`pnpm lint`、`pnpm typecheck`、Web 22 文件/65 项测试、Java 17 项测试、Next.js/Java 构建与 Prisma 校验通过；生产构建包含 `/report-tasks/[taskId]/generation` 路由。

### 2026-09-23 — 模板列表按需展开与删除

- [x] 模板管理页默认只显示名称、版本、文件名、状态和页数；展开单条模板时才通过受权接口读取各页预览及占位符。
- [x] 模板创建者可经二次确认删除模板。删除使用已有 `ARCHIVED` 状态并记录操作日志，从模板列表及新任务选择中移除，保留已有任务、文件和预览；解析中的模板暂不可删除。
- [x] 同步模板接口、领域说明、需求和 ADR-0015。

验证：`pnpm lint`、`pnpm typecheck`、Web 24 文件/73 项测试、Java 17 项测试、Next.js/Java 构建与 Prisma 校验通过；测试覆盖按需加载、删除确认、创建者权限、归档与操作日志。

### 2026-09-23 — 填报中任务沿用审核三栏布局

- [x] “填报中”的任务详情将逐页填报情况作为主体，沿用审核阶段的缩略图导航、PPT 主预览与右侧当前页内容布局。
- [x] 仍可调整页面分配，但改为逐页视图下方默认折叠的区域；草稿任务继续优先展示分配表单。
- [x] 填报阶段标题和计数改为已提交人数，不显示未到阶段的审核确认数。

验证：新增交互测试覆盖填报中三栏工作区、预览切页与只读状态；`pnpm lint`、`pnpm typecheck`、Web 24 文件/74 项测试、Java 17 项测试、Next.js/Java 构建与 Prisma 校验通过。

### 2026-09-23 — 收集人可在填报中自行确定页面值

- [x] 填报中任务的逐页工作区开放收集人填写：每个占位符可人工输入，或按月份查询指标并保存；右侧显示已保存的最终值和来源，页面状态可显示“收集人已填”。
- [x] 最终值接口在 `FILLING`/`REVIEWING` 接受人工值与指标值；指标由服务端读取并冻结快照，提交值仍须在审核阶段选用。保留任务版本锁、审计与退回失效规则。
- [x] 同步 Prisma 枚举迁移、API 契约、领域说明、需求及 ADR-0016；P5 冒烟脚本加入提前人工填写的断言。

验证：`pnpm lint`、`pnpm typecheck`、Web 24 文件/75 项测试、Java 17 项测试、Next.js 构建与 Prisma 校验通过。P5 联调脚本需具备已启动服务和测试账号的环境后运行。

### 2026-09-23 — PPT 预览加载动画

- [x] 共用预览组件的加载层改为深色实底，避免底图透出造成浅色遮罩；使用浮动页面、扫光与移动进度条表现加载过程。
- [x] 图片加载完成后移除动画，失败提示保持可见；系统开启减少动态效果时显示静态状态。

验证：`pnpm lint`、`pnpm typecheck`、Web 24 文件/75 项测试和 Next.js 构建通过；组件测试覆盖加载动画出现与图片加载后消失。

### 2026-09-23 — 指标月份选择与无数据月份禁用

- [x] 指标管理、填报页和审核页的指标检索统一使用只到月份的日历控件；按年查询可用月份，无指标月份置灰、不可选择，数据源失败时提供重试。
- [x] Web 为 Collector 与有权 FillInstance 成员分别提供可用月份接口；MySQL Adapter 只查询启用数据源和已配置映射对应的源库月份，多个来源去重合并。
- [x] 创建报告任务的报告周期改为原生月份选择，仍允许没有指标的月份用于人工填报；同步接口契约、需求、架构与 ADR-0017。

验证：`pnpm lint`、`pnpm typecheck`、Web 26 文件/78 项测试、Next.js 构建与 Prisma 校验通过；新增测试覆盖可用月份查询过滤、聚合和无指标月份禁用。

### 2026-09-23 — amd64 内网部署包与本机测试数据

- [x] Web 和 PPT Service 以当前工作树构建 `linux/amd64` 镜像；Web 的 Prisma Client 同时包含目标 Linux musl 查询引擎。PPT 镜像包含 LibreOffice 与 Noto CJK 字体。
- [x] 将两张应用镜像和 MySQL 8.0.27 客户端镜像导出为离线归档；制作不触发在线构建/拉取的 Compose、数据库导入、指标源重新加密和共享文件卷恢复脚本。
- [x] 从本机 `report_platform` 与 `report_metrics_demo` 导出一致性 SQL，从 `data` 目录导出模板、预览与生成文件。导出前修复 3 个缺失文件：源 PPTX 与已有同 SHA 模板相同，两个预览复用同源模板渲染图并更新文件摘要；53 条 StoredFile 记录的文件与大小/摘要全部一致。
- [x] 编写目标为已有 MySQL 服务器的 [内网部署说明](intranet-deployment.md)，明确账号、密钥、指标源、验证、备份和测试数据限制。

验证：`pnpm lint`、`pnpm typecheck`、Web 26 文件/78 项测试、Next.js build、Java `clean package`/tests、Prisma validate、Compose config 均通过；Web amd64 容器 `/api/health/live` 与连接真实本机 MySQL 的 `/api/health/ready` 均为 200，PPT amd64 容器 readiness 为 200。Compose `up -d --no-build --pull never` 后两服务均 healthy、Web readiness 为 200。SQL 在临时空 MySQL 8.0.27 中导入成功，27 张表与本机逐表行数一致，含 6 条迁移、12 条指标；重复导入被拒绝。重新加密脚本更新 1 个指标源，并用更新后凭据查询到 12 条指标。共享文件归档在临时 Docker 卷解包成功。镜像归档经 `docker load` 复验三张镜像标签。目标内网服务器、真实连接参数和断公网演练尚未验证。

## 进行中

- P6 收尾：浏览器审核和生成面板的实际交互、权限、异常状态与全页视觉回归；P4 企业库 Adapter 待拿到真实表结构后实现。

## 下一步

1. 检查 P5 审核面板及 P6 生成/预览/导出在浏览器中的交互、权限与异常提示；逐页对照目标字体环境。
2. 在企业目标内网取得真实指标库表结构、权限与连接参数，将示例固定映射扩展为受控映射；禁止原始 SQL 输入。
3. 在目标内网执行部署包导入、数据源连接、跨库恢复与断公网演练；P7 补生成文件异常补偿。

## 当前风险与待验证假设

- LibreOffice 与 Microsoft PowerPoint 可能存在字体/换行差异；部署镜像需要固定字体集和 LibreOffice 版本。
- 草稿与 P6 最终报告均采用 PPT 原生 TextRun 替换；PDF/PNG 基于 LibreOffice，仍可能与 Microsoft PowerPoint 的字体和换行不同，必须在目标环境人工检查。
- 外部企业指标库的表结构与写权限尚未给出；当前 Adapter 只对独立示例库的固定 `metric_record` 表开放参数化查询和修改。
- 外部源库与平台库无法共享事务；源库更新后平台镜像失败会报 `SYNC_PENDING`，当前提供 Collector 手动对账并要求源库版本历史连续，尚无后台自动重试任务。
- 当前采用内置凭据身份源；若改接企业 OAuth/OIDC，应保持业务 User ID 与资源授权逻辑不变，并单独设计账户映射。
- JWT 仅承载用户 ID，角色和停用状态由每次业务请求实时查询；正式大规模部署前仍需分布式登录限流、账户恢复与登录审计。
- 已制作 amd64 镜像归档；目标内网仍须验证断公网启动、HTTP/HTTPS 入口与代理访问控制及备份恢复演练。

## 更新模板

```text
### YYYY-MM-DD — Px / 工作项
- 结果：
- 变更：
- 验证：精确命令与结果
- 遗留：
- 下一步：
```
