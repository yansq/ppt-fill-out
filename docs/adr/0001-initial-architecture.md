# ADR-0001：首版采用双服务 Monorepo 与同步 PPT 工作流

- 状态：Accepted
- 日期：2026-09-20

## 背景

平台既包含用户、任务、权限、指标和审核等业务能力，也包含依赖 Apache POI 与 LibreOffice 的 PPT 解析/生成能力。首版需要尽快完成一条可运行链路，同时避免引入队列、服务注册等不必要复杂度。

## 决策

1. 使用 Monorepo 管理 Next.js `report-web`、Spring Boot `ppt-service`、Prisma 数据库包及共享前端包。
2. Next.js 是主要业务服务与浏览器唯一入口；PPT Service 只处理文件解析、生成和渲染。
3. 两个服务通过内部 HTTP 契约通信，并共享挂载到 `/data` 的 Docker Volume；数据库仅保存文件元数据。
4. 系统 MySQL 不强制加入 Compose，通过 `DATABASE_URL` 连接宿主机或外部数据库。
5. 首版同步执行 PPT 任务，但使用独立 service/client、状态记录和幂等键，保留未来异步化空间。
6. 最终 PPT 只使用 FinalValue；AI 只产生可编辑候选文本。
7. 不引入 Redis、消息队列、Kubernetes、Elasticsearch、Redux 或额外 NestJS 服务。

## 结果

正面影响：组件边界清晰；PPT 依赖与 Node 业务隔离；部署单纯；首个 Vertical Slice 可快速验证最大技术风险。

代价与约束：共享 Volume 适合首版单机部署，不直接满足多节点扩容；同步生成会占用请求时间；文件与数据库需采用状态机和补偿而非分布式事务。未来迁移对象存储或异步队列时，必须保持现有领域和 API 边界。

