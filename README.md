# PPT 协同填报与自动报告生成平台

基于固定 `.pptx` 模板，通过结构化指标、人工填报、字段绑定、AI 文本辅助与 Apache POI，稳定生成尽量保持模板格式不变的报告。

当前已完成 **P2 模板解析 Vertical Slice**，下一阶段是 **P3 任务与页面分发**。P2 已打通模板上传、真实 PPTX 解析、页缩略图、持久化、失败重试与审计链路。

## 文档导航

- [产品与范围](docs/requirements.md)：角色、业务规则、状态机、MVP 与非目标
- [系统架构](docs/architecture.md)：系统边界、组件、文件流、权限与部署
- [领域与数据模型](docs/domain-model.md)：聚合、值模型、关系、约束与并发策略
- [接口契约草案](docs/api-contracts.md)：Web API、PPT Service API 与错误模型
- [开发计划](docs/development-plan.md)：阶段、任务、依赖、验收标准与测试策略
- [开发进度](docs/progress.md)：当前状态、完成项、阻塞项与下一步
- [架构决策记录](docs/adr/0001-initial-architecture.md)：首版关键技术决策

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
pnpm dev
```

另一个终端启动 PPT Service：

```bash
set -a; source .env; set +a
STORAGE_ROOT="$PWD/data" mvn -f apps/ppt-service/pom.xml spring-boot:run
```

本地端点：

- Web：`http://localhost:3000`
- Web liveness：`GET /api/health/live`
- Web readiness：`GET /api/health/ready`，关键配置或系统 MySQL 不可用时返回 503
- 模板管理：`GET /templates`，非生产环境需配置 `P2_DEVELOPMENT_ACTOR_EMAIL`

P2 尚未接入 Auth.js。容器端到端验证可临时设置 `P2_ALLOW_INSECURE_ACTOR=true`；共享或生产环境必须保持 `false`，此时模板接口返回 501，等待 P3 接入真实身份与资源授权。
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

## 交付纪律

每完成一个开发阶段，必须：

1. 运行该阶段约定的单元测试、集成测试或真实 PPTX 验证。
2. 完成 TypeScript 类型检查、Next.js 构建和 Java 编译。
3. 更新本 README 中可运行说明（进入实现阶段后）。
4. 更新 [docs/progress.md](docs/progress.md)，记录证据、遗留问题和下一阶段入口条件。
