# PPT 协同填报与自动报告生成平台

基于固定 `.pptx` 模板，通过结构化指标、人工填报、字段绑定、AI 文本辅助与 Apache POI，稳定生成尽量保持模板格式不变的报告。

当前已完成 **P3 任务与页面分发**，下一阶段是 **P4 指标与填报**。登录、模板、任务创建、多人同页分配、独立填报实例与进度主链路已打通。

## 文档导航

- [产品与范围](docs/requirements.md)：角色、业务规则、状态机、MVP 与非目标
- [系统架构](docs/architecture.md)：系统边界、组件、文件流、权限与部署
- [领域与数据模型](docs/domain-model.md)：聚合、值模型、关系、约束与并发策略
- [接口契约草案](docs/api-contracts.md)：Web API、PPT Service API 与错误模型
- [开发计划](docs/development-plan.md)：阶段、任务、依赖、验收标准与测试策略
- [开发进度](docs/progress.md)：当前状态、完成项、阻塞项与下一步
- [架构决策记录](docs/adr/0001-initial-architecture.md)：首版关键技术决策
- [P3 身份决策](docs/adr/0003-authjs-credentials-and-live-authorization.md)：凭据登录、密码哈希与实时授权
- [企业内网运行决策](docs/adr/0004-enterprise-intranet-runtime.md)：无公网运行时依赖、内部入口与离线镜像交付
- [P3 分配决策](docs/adr/0005-p3-assignment-replacement.md)：版本化集合替换与已开始实例保护
- [内网 HTTP 入口决策](docs/adr/0006-intranet-http-auth-url.md)：允许无 HTTPS 的内网入口及边界控制
- [用户名认证决策](docs/adr/0007-username-credentials.md)：用户名登录、可选邮箱与旧用户迁移

## 目标技术栈

- Web：Next.js、TypeScript、Tailwind CSS、Radix UI、shadcn/ui、@shadcn/lint、TanStack Table、Auth.js、Zod、Vercel AI SDK
- 系统数据：MySQL、Prisma ORM
- PPT 服务：Java 17、Spring Boot、Apache POI、LibreOffice Headless
- 部署：Docker Compose；`report-web` 与 `ppt-service` 共享 `/data` Volume；MySQL 可位于宿主机、外部服务器或其他容器

## 仓库结构

```text
apps/
  web/          Next.js 16 Web 与健康检查
  ppt-service/  Spring Boot 3 / Java 17 / Apache POI / LibreOffice
packages/
  database/     Prisma schema、初始 migration 与 Prisma Client
  shared/       跨前端包共享类型
  ui/           Radix/shadcn 风格的共享 UI 组件
docker/
  docker-compose.yml
docs/
```

## 本地开发

要求：Node.js 20.19+、pnpm 10+、Java 17、Maven 3.9+、MySQL 8 兼容数据库，以及用于真实渲染的 LibreOffice。

```bash
cp .env.example .env
# 编辑 .env 后，将变量载入当前 shell；Next.js 从 apps/web 启动，不会自动读取仓库根目录的 .env。
set -a
source .env
set +a
pnpm install
pnpm db:generate
pnpm --filter @report-platform/database migrate:deploy
pnpm --filter @report-platform/database seed:auth
pnpm dev
```

`seed:auth` 无额外变量时仅创建 Collector/Filler 角色。创建登录用户时，在该命令的进程环境中同时设置 `AUTH_SEED_USERNAME`、`AUTH_SEED_PASSWORD`（默认至少 12 位）和 `AUTH_SEED_ROLE=COLLECTOR|FILLER`；不要将密码写入仓库文件或 shell 历史。它会为现有同用户名用户设置/重置密码。仅在隔离测试环境显式设置 `AUTH_SEED_ALLOW_WEAK_PASSWORD=1` 时允许至少 6 位密码。登录入口为 `/api/auth/signin`，使用用户名和密码，无邮箱格式要求；当前没有自助注册。必须设置足够长且保密的 `AUTH_SECRET`。`AUTH_URL` 应指向浏览器实际访问的 HTTP 或 HTTPS 地址，不能包含账号密码。

本机上传模板时，Web 必须配置绝对路径 `STORAGE_ROOT`（例如仓库的 `data` 目录）、`PPT_SERVICE_URL=http://127.0.0.1:8080` 和非示例值 `PPT_SERVICE_API_KEY`。PPT Service 要使用相同的 `STORAGE_ROOT` 和 `PPT_SERVICE_API_KEY`；`pnpm dev` 只启动 Web，不会自动启动 Java 服务。若用 `apps/web/.env.local` 保存本机配置，Next.js 会自动读取它，但启动 Java 服务的终端仍需显式载入这些变量。该文件已被 Git 忽略。

本机 LibreOffice 缺少可用的中文字体回退时，上传可以成功，但预览可能把中文画成方框或留白。建议使用已安装 `fonts-noto-cjk` 的 PPT Service 镜像，并将 Web 的本地 `data` 目录挂载为容器 `/data`；先执行 `docker build -t report-platform-ppt-service:latest apps/ppt-service`，再在仓库根目录运行：

```bash
set -a; source apps/web/.env.local; set +a
docker run --rm --name ppt-fill-out-local-service \
  -p 127.0.0.1:8080:8080 \
  -e PPT_SERVICE_API_KEY="$PPT_SERVICE_API_KEY" -e STORAGE_ROOT=/data \
  -v "$PWD/data:/data:rw" report-platform-ppt-service:latest
```

若使用 macOS 原生 LibreOffice，需使进程能加载系统中文字体；在本机 Homebrew Fontconfig 环境下可设置 `FONTCONFIG_FILE=/opt/homebrew/etc/fonts/fonts.conf`，并重新启动 PPT Service。更换字体环境后，旧缩略图不会自动重绘。

另一个终端启动 PPT Service：

```bash
set -a; source .env; set +a
STORAGE_ROOT="$PWD/data" mvn -f apps/ppt-service/pom.xml spring-boot:run
```

本地端点：

- Web：`http://localhost:3000`
- Web liveness：`GET /api/health/live`
- Web readiness：`GET /api/health/ready`，关键配置或系统 MySQL 不可用时返回 503
- 模板管理：`GET /templates`，须先登录；Collector 可上传，只有模板创建者或关联任务成员可读取
- 报告任务：`GET /report-tasks`，Collector 创建任务、按页分配 Filler 并查看进度
- 我的填报：`GET /my-tasks`，只列出当前账号的 FillInstance
- PPT liveness：`GET http://localhost:8080/actuator/health/liveness`
- PPT readiness：`GET http://localhost:8080/actuator/health/readiness`

## Docker Compose

默认 Compose 只包含 `report-web` 与 `ppt-service`，不会启动 MySQL。先将 `.env.example` 复制为 `.env` 并替换全部密钥及数据库连接：

```bash
cp .env.example .env
docker compose --env-file .env -f docker/docker-compose.yml config
docker compose --env-file .env -f docker/docker-compose.yml up --build
```

macOS/Windows 容器连接宿主机 MySQL 时使用 `host.docker.internal`。Compose 已为 Linux 配置 `host-gateway` 映射；独立数据库服务器则直接填写其可路由地址。两个服务共享命名 Volume `report-data:/data`，Web 只暴露 3000 端口，PPT Service 仅在内部网络可见。

企业内网运行时，默认只在宿主机回环地址发布 Web 端口。若通过内网反向代理访问，代理不在同一主机时，将 `WEB_BIND_ADDRESS` 改为受控内网 IP；`WEB_PORT` 可调整宿主机端口，`AUTH_URL` 必须与浏览器实际访问的 HTTP 或 HTTPS 地址一致。无 HTTPS 时，登录密码和会话 Cookie 会在网络中明文传输，仅可在可信内网使用，并通过网络隔离、访问控制和防火墙限制入口，不得暴露公网；条件允许后应启用 TLS。代理应清理并重写 Host/Forwarded 头。构建机可联网下载依赖，但部署节点应从内部镜像仓库或预加载镜像启动；核心流程不访问公网。AI 配置仅为 P7 预留，不能把公网模型 API 当作内网部署的前置依赖。

## 校验命令

```bash
pnpm lint
DATABASE_URL='mysql://user:password@127.0.0.1:3306/report_platform' pnpm typecheck
pnpm test
DATABASE_URL='mysql://user:password@127.0.0.1:3306/report_platform' pnpm build
mvn -f apps/ppt-service/pom.xml clean package
DATABASE_URL='mysql://user:password@127.0.0.1:3306/report_platform' pnpm db:validate
docker compose --env-file .env -f docker/docker-compose.yml config --quiet
```

P3 真实数据库/HTTP 冒烟测试需要一个专用 `@local.test` Collector（拥有无凭据的 READY 模板）及运行中的 Web 服务。设置 `P3_SMOKE_BASE_URL` 与 `P3_SMOKE_COLLECTOR_EMAIL` 后执行 `pnpm --filter @report-platform/web test:p3:smoke`；脚本会临时创建登录凭据、两名 Filler、任务和实例，验证后清理。不要指向真实员工账号。

## 交付纪律

每完成一个开发阶段，必须：

1. 运行该阶段约定的单元测试、集成测试或真实 PPTX 验证。
2. 完成 TypeScript 类型检查、Next.js 构建和 Java 编译。
3. 更新本 README 中可运行说明（进入实现阶段后）。
4. 更新 [docs/progress.md](docs/progress.md)，记录证据、遗留问题和下一阶段入口条件。
