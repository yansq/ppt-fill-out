# PPT 协同填报与自动报告生成平台

基于固定 `.pptx` 模板，通过结构化指标、人工填报、字段绑定、AI 文本辅助与 Apache POI，稳定生成尽量保持模板格式不变的报告。

当前仓库处于 **设计与工程基线阶段**。在首个端到端切片验证通过前，不扩展任务分发、审核等后续功能。

## 文档导航

- [产品与范围](docs/requirements.md)：角色、业务规则、状态机、MVP 与非目标
- [系统架构](docs/architecture.md)：系统边界、组件、文件流、权限与部署
- [领域与数据模型](docs/domain-model.md)：聚合、值模型、关系、约束与并发策略
- [接口契约草案](docs/api-contracts.md)：Web API、PPT Service API 与错误模型
- [开发计划](docs/development-plan.md)：阶段、任务、依赖、验收标准与测试策略
- [开发进度](docs/progress.md)：当前状态、完成项、阻塞项与下一步
- [架构决策记录](docs/adr/0001-initial-architecture.md)：首版关键技术决策

## 目标技术栈

- Web：Next.js、TypeScript、Tailwind CSS、Radix UI、shadcn/ui、TanStack Table、Auth.js、Zod、Vercel AI SDK
- 系统数据：MySQL、Prisma ORM
- PPT 服务：Java 17、Spring Boot、Apache POI、LibreOffice Headless
- 部署：Docker Compose；`report-web` 与 `ppt-service` 共享 `/data` Volume；MySQL 可位于宿主机、外部服务器或其他容器

## 交付纪律

每完成一个开发阶段，必须：

1. 运行该阶段约定的单元测试、集成测试或真实 PPTX 验证。
2. 完成 TypeScript 类型检查、Next.js 构建和 Java 编译。
3. 更新本 README 中可运行说明（进入实现阶段后）。
4. 更新 [docs/progress.md](docs/progress.md)，记录证据、遗留问题和下一阶段入口条件。

