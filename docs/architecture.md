# 系统架构

## 1. 总体结构

```text
Browser
  |
  v
report-web :3000 (Next.js)
  |-- System MySQL via DATABASE_URL
  |-- MetricDataSource adapters
  |-- AI provider (OpenAI-compatible)
  `-- ppt-service :8080 (internal)
          |-- Apache POI
          `-- LibreOffice Headless

report-web <---- shared Docker volume /data ----> ppt-service
```

首版只有两个应用服务。Next.js 是业务边界与唯一面向浏览器的入口；PPT Service 是无用户概念、职责单一的内部服务。

## 2. Monorepo 目标结构

```text
apps/
  web/
    src/features/{auth,template,report-task,fill-instance,binding,metric,review,ai,datasource}
  ppt-service/
    src/main/java/.../{controller,service,parser,renderer,generator,model,storage}
packages/
  database/prisma/
  ui/
  shared/
docker/docker-compose.yml
data/.gitkeep
docs/
```

跨语言边界不共享运行时代码。PPT Service 的 OpenAPI/JSON Schema 是契约源，TypeScript 客户端类型由契约生成或显式校验。

## 3. 组件职责

### report-web

- Auth.js 登录、会话和角色映射；
- 资源级授权；
- 模板、任务、FillInstance、绑定、三级 Value、审核与操作日志；
- 指标 Adapter 调用及指标变更事务；
- AI 文本候选生成；
- 文件元数据、受控下载和 PPT Service 调度。

### ppt-service

- 校验并解析 `.pptx`；
- 识别跨 TextRun 和 Table Cell 的业务占位符；
- 按 run/paragraph 粒度替换，尽量继承占位符起始 run 样式；
- 调用 LibreOffice 渲染 PDF/PNG；
- 返回结构化元数据、生成文件信息与版式告警。

它不连接系统数据库，不处理用户、权限、指标、AI、任务或审核。

## 4. 关键数据流

### 模板上传与解析

1. Web 校验权限、扩展名、MIME、大小并计算 SHA-256。
2. 文件先写 `/data/temp`，完成校验后原子移动到 `/data/templates/{templateId}/{hash}.pptx`。
3. Web 以受控内部请求调用 `/ppt/parse`，传文件标识/路径而非公开 URL。
4. PPT Service 只允许访问配置的 `/data` 子目录，返回 slides/shapes/placeholders。
5. Web 在事务中保存模板、页面、占位符和解析版本；失败时模板标为 `PARSE_FAILED`，保留可诊断错误。

### 填报与提交

1. Web 服务端确认当前用户拥有 FillInstance。
2. 指标查询使用 `viewPeriod`；绑定保存 metricDefinitionId、实际 period 和 SourceValue 快照。
3. 草稿可更新绑定与人工值；提交事务冻结 SubmittedValue，并使用 `version` 做乐观锁。
4. 后续指标变化不反向修改已提交快照。

### 审核、生成与导出

1. Collector 读取任务内 SubmittedValue，显式解决冲突并保存 FinalValue。
2. Web 校验 FinalValue 完整性并锁定本次生成快照。
3. `/ppt/generate` 以模板文件和 key/value 集合生成新文件，绝不覆盖模板。
4. `/ppt/render` 生成真实预览；通过后导出并记录文件哈希、生成快照和操作日志。

## 5. PPT 解析与替换设计

对每个文本容器，先建立“逻辑全文 + 字符到 run 的映射”，再在逻辑全文中识别 `{{key}}`。因此占位符可跨 run，元数据同时保存起止 run/offset。替换时：

1. 从后向前处理匹配，避免偏移变化；
2. 将替换文本放入占位符起始 run；
3. 删除占位符覆盖范围内其余字符，不重建整个 shape；
4. 保留未涉及 run 与 paragraph；
5. 表格逐 cell 使用同一算法；
6. 对重复 key 保留每个 occurrence，生成时同 key 使用同一 FinalValue。

涉及 POI 或 OOXML 的不确定行为，必须先用真实 PPTX fixture 写最小测试，包括：单 run、多占位符、跨 run、表格、混合样式和非 ASCII 文本。

## 6. 快速预览

解析时生成去除或隐藏动态文本后的静态页背景图，并返回动态 shape 的几何与样式。浏览器按 PPT 页面尺寸做等比缩放，将动态内容以绝对定位 DOM 覆盖。Fast Preview 只用于编辑反馈，UI 必须提供 Real Preview 入口并提示二者可能存在差异。

## 7. 安全边界

- 浏览器永不直接调用 PPT Service；服务只暴露在 Compose 内网。
- 所有业务 API 先认证，再做 task/fill-instance/file 资源校验。
- 上传文件采用白名单、大小限制、ZIP bomb 防护、路径规范化和随机服务端文件名。
- 数据源凭据使用带版本的应用层加密封装；密钥不入库。
- AI 与日志输入需脱敏；错误响应不泄露文件系统路径、SQL 或凭据。
- 下载使用授权后的流式响应或短时签名令牌。

## 8. 一致性、事务与幂等

- 数据库实体使用 `version` 和 `updatedAt`；审核、指标修改和提交采用乐观锁。
- 创建任务与分配、提交与 SubmittedValue 快照、审核与 FinalValue 写入分别位于数据库事务中。
- 文件系统与数据库无法共享事务：采用状态字段（如 `UPLOADING/PARSING/READY/FAILED`）和可重试补偿清理。
- parse/generate 请求携带幂等键；相同模板哈希与解析器版本可复用解析结果。

## 9. 部署与配置

- Compose 必含 `report-web`、`ppt-service` 与命名 Volume `report-data:/data`，不强制包含 MySQL。
- `DATABASE_URL` 支持宿主机或外部地址；文档分别说明 macOS/Windows 的 `host.docker.internal` 与 Linux host-gateway 配置。
- 健康检查区分 liveness 与 readiness。PPT readiness 检查 Java 服务与 LibreOffice 可执行文件；Web readiness 检查关键配置和系统数据库连接，不强制 AI/指标数据源在线。

## 10. 可观测性

- 每个请求带 correlation id，并透传至 PPT Service。
- 结构化日志不得包含密码、API Key 或完整业务敏感文本。
- 首版至少记录上传/解析/渲染/生成耗时、状态和失败原因；后续可在不改变业务接口的前提下接入 metrics/tracing。

