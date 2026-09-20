# 开发计划

## 1. 执行原则

- 按 Vertical Slice 推进，每阶段必须产生可运行、可验证的结果，不用 fake implementation 填空。
- 未验证的 POI/OOXML 行为先做真实 PPTX 最小实验。
- 每阶段结束执行测试、类型检查和构建，并同步更新 README 与 `docs/progress.md`。
- 发现需求变更时先更新相关设计或 ADR，再修改实现。
- `progress.md` 是状态真值；本文件描述计划，不用“完成”字样冒充实际进度。

## 2. 阶段总览

| 阶段 | 目标 | 入口条件 | 主要交付物 |
|---|---|---|---|
| P0 | 设计与工程基线 | 原始需求已提供 | 本文档集、决策记录、进度台账 |
| P1 | Monorepo 可启动 | P0 评审通过 | Web/PPT Service/Prisma/Compose/Volume/health |
| P2 | 模板解析 Vertical Slice | P1 构建通过 | 上传、存储、POI 解析、持久化、页/占位符列表 |
| P3 | 任务与页面分发 | P2 真实 PPTX 验证通过 | ReportTask、分配、FillInstance、进度 |
| P4 | 指标与填报 | P3 权限测试通过 | MySQL Adapter、绑定、人工值、Fast Preview、提交 |
| P5 | 审核与 FinalValue | P4 提交流程通过 | 多人结果、冲突解决、退回、乐观锁 |
| P6 | 生成与真实预览 | P5 FinalValue 完整 | POI 生成、LibreOffice PNG/PDF、下载、溢出告警 |
| P7 | AI、加固与交付 | 主链路通过 | AI 候选、审计补齐、安全/恢复/部署验证 |

## 3. P0：设计与工程基线

任务：

- 固化产品范围、术语、权限和三级 Value 规则。
- 固化组件边界、数据流、初始数据模型和接口契约。
- 建立阶段计划、Definition of Done 与进度更新模板。

验收：文档之间无关键概念冲突；MVP 主链路和非目标明确；下一阶段可直接按任务列表初始化工程。

## 4. P1：工程初始化

任务：

1. 初始化 pnpm workspace/Turborepo（若实际脚手架评估不需要 Turborepo，只保留 pnpm workspace 并记录 ADR）。
2. 创建 Next.js TypeScript 应用，配置 Tailwind、Radix/shadcn 基础组件与 ESLint。
3. 创建 Java 17 Spring Boot 服务，引入 Web、Validation、Actuator、Apache POI。
4. 建立 Prisma package、MySQL provider 与初始 schema/migration。
5. 创建 Compose：`report-web`、`ppt-service`、共享 `report-data:/data`，不强制 MySQL。
6. 创建 `.env.example`，覆盖数据库、Auth、PPT Service、存储、加密与 AI 配置。
7. 实现 Web 与 PPT Service liveness/readiness。
8. 写本地和 Docker 启动说明。

验收命令在实现时固定为仓库脚本，至少覆盖：JS lint/typecheck/test/build、Gradle/Maven test/package、Prisma validate、Compose config 与两个服务 health。

## 5. P2：模板解析 Vertical Slice

任务：

1. Collector 上传 `.pptx`，完成权限、大小、MIME、ZIP 安全和哈希校验。
2. 写入共享 Volume，并保存 StoredFile/ReportTemplate 状态。
3. Web 调用 `/ppt/parse`；PPT Service 解析页、shape、文本、table、geometry 和 style。
4. 实现逻辑全文到 TextRun 字符映射，识别单 run、跨 run、多占位符和表格占位符。
5. 在事务中持久化 TemplateSlide/TemplatePlaceholder。
6. 生成或保存页缩略图；Web 展示页列表和占位符详情。
7. 增加失败状态、重试和上传/解析审计。

真实 fixture：至少包含普通文本、同段多 key、跨 run、混合字体、表格、中文、重复 key、无占位符页及非法/损坏文件。

验收：从浏览器上传真实 PPTX 后，数据库记录与人工检查一致；重启容器后文件和数据仍存在；未授权用户无法读取；构建和测试全部通过。

## 6. P3：任务与页面分发

- Auth.js 登录与角色种子数据。
- 创建带 `reportPeriod` 的 ReportTask。
- 页缩略图上分配多个 Filler；事务化创建 assignment/FillInstance。
- Filler 我的任务、Collector 总体和逐页进度。
- 状态迁移服务和资源级授权测试。

验收重点：同一页多人拥有隔离的 FillInstance；Filler 无法枚举或访问他人的实例。

## 7. P4：指标、绑定、Fast Preview 与提交

- 数据源后台配置、凭据加密和连接测试。
- `MetricDataSource` 抽象与 MySQL Adapter；按 reportPeriod 默认查询。
- 独立 `viewPeriod`、历史月份醒目提示与实际 period 快照。
- DATABASE_METRIC/MANUAL_TEXT 绑定和草稿保存。
- 静态背景 + DOM 动态层 Fast Preview。
- 指标修改、原因、history、外部库失败处理。
- 提交事务生成 SubmittedValue 快照。

验收重点：切换查看月份不改变任务月份；已提交值不随源指标变化；越权更新和并发覆盖被拒绝。

## 8. P5：审核与 FinalValue

- 同页多人提交聚合视图。
- 一致/冲突/缺失标识。
- 采用某提交值或手工值；所有选择写 FinalValue 与审计。
- 退回与重新提交 revision。
- expectedVersion 乐观锁。

验收重点：没有自动覆盖；并发审核得到明确 409；完成任务前 FinalValue 完整性检查有效。

## 9. P6：PPT 生成与 Real Preview

- 以 FinalValue 快照调用 `/ppt/generate`。
- run 级替换、表格替换、模板不可变和缺失 key 报告。
- LibreOffice Headless 输出 PDF/PNG。
- 文本溢出策略及 layout warning。
- 受控预览/下载、GeneratedFile 与导出审计。

验收重点：用真实 PPTX 比对字体、字号、颜色、强调、对齐、行距和固定元素；Fast Preview 明确不作为最终验收依据。

## 10. P7：AI、加固与交付

- Vercel AI SDK OpenAI-Compatible provider 配置。
- 输入快照、候选生成、人工编辑确认和日志；AI 不直接写 FinalValue/PPT。
- 文件清理补偿、备份恢复演练、日志脱敏、安全测试和资源限制。
- Compose 生产配置、运维手册和 MVP 回归测试。

## 11. 阶段 Definition of Done

每个阶段只有同时满足以下条件才可标记完成：

- 功能达到本阶段验收标准，没有用静态假数据代替关键路径。
- 关键 happy path、权限失败、校验失败和并发/状态边界有自动化测试。
- TypeScript、Java、Prisma 与容器配置检查通过。
- 相关数据库迁移可在空库执行，必要时有回滚/恢复说明。
- README、接口/架构文档和进度台账与实现一致。
- 已知限制、未完成项和验证证据写入 `docs/progress.md`。

## 12. 进度更新方法

开发期间每完成一个可验证任务，更新 `docs/progress.md`：

- 把任务从“进行中/待办”移到“已完成”，附日期与证据（测试命令、fixture 或页面路径）。
- 记录决策偏差；影响架构时新增 ADR。
- 写清当前阻塞、风险及下一项具体工作。
- 阶段完成时记录完整验证矩阵，不能只写“测试通过”。

