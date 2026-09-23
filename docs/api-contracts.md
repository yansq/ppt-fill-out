# 接口契约草案

所有 Web API 输入使用 Zod 校验，输出使用稳定 DTO；所有 PPT Service 输入输出使用 Bean Validation 与 OpenAPI 描述。时间为 ISO 8601 UTC，月份为 `YYYY-MM`，ID 首版统一使用 CUID2 或 UUID（初始化时二选一并全局统一）。

## 1. 通用错误

```json
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "资源已被其他用户更新",
    "correlationId": "...",
    "details": {}
  }
}
```

错误码至少包括：`UNAUTHENTICATED`、`FORBIDDEN`、`NOT_FOUND`、`VALIDATION_ERROR`、`VERSION_CONFLICT`、`INVALID_STATE_TRANSITION`、`PPT_PARSE_FAILED`、`PPT_RENDER_FAILED`、`PPT_GENERATE_FAILED`、`DATASOURCE_UNAVAILABLE`。

## 2. Web 业务 API（首版路线）

实际可采用 Route Handlers 或 Server Actions；无论传输形式如何，下列服务边界与授权规则保持一致。

P3 登录入口为 Auth.js `GET/POST /api/auth/[...nextauth]`，Credentials 接收 6 位 `employeeNumber` 和 `password`。业务 API 从服务端会话取得用户 ID，不接受调用方提交的 `actorId`。无会话返回 401，无角色返回 403；无权访问的模板及其缩略图按 404 隐藏资源存在性。

| 能力 | 建议接口 | 服务端授权 |
|---|---|---|
| 上传模板 | `POST /api/templates` | Collector |
| 查询模板详情与模板页 | `GET /api/templates/{id}` | 创建者或有权任务成员 |
| 删除模板 | `DELETE /api/templates/{id}` | 模板创建者 Collector |
| 创建任务 | `POST /api/report-tasks` | Collector |
| 任务列表与详情 | `GET /api/report-tasks`、`GET /api/report-tasks/{id}` | 任务 Collector |
| 分配页面 | `PUT /api/report-tasks/{id}/assignments` | 任务 Collector |
| 我的填报实例 | `GET /api/fill-instances/mine` | 当前用户 |
| 填报详情 | `GET /api/fill-instances/{id}` | assignee 或任务 Collector |
| 开始填报 | `POST /api/fill-instances/{id}/start` | 实例 assignee 且持有 Filler 角色 |
| 更新绑定/草稿 | `PUT /api/fill-instances/{id}/bindings/{placeholderId}` | assignee；可编辑状态 |
| 提交 | `POST /api/fill-instances/{id}/submit` | assignee；expectedVersion |
| 退回 | `POST /api/fill-instances/{id}/return` | 任务 Collector |
| 指标查询 | `GET /api/metrics?period=...` | 有关联任务权限 |
| 指标修正 | `PUT /api/metrics/{id}` | 可写指标权限；expectedVersion + reason |
| 保存最终值 | `PUT /api/report-tasks/{id}/final-values/{placeholderId}` | 任务 Collector |
| AI 候选 | `POST /api/report-tasks/{id}/ai-generations` | 任务 Collector |
| 真实预览 | `POST /api/report-tasks/{id}/real-preview` | 任务 Collector |
| 导出 | `POST /api/report-tasks/{id}/exports` | 任务 Collector |
| 下载文件 | `GET /api/files/{id}` | 由文件关联资源决定 |

P4 第一切片新增 `GET/POST /api/data-sources` 和 `POST /api/data-sources/{id}/test`，均仅允许 Collector。创建请求为 `{ name, host, port?, databaseName, username, password }`，目前只创建 `MYSQL` 类型。列表及创建响应不包含密码或密文；连接测试成功返回 `{ ok: true, latencyMs }`，失败统一返回 `DATASOURCE_UNAVAILABLE`，不暴露驱动错误。配置启用状态与连接健康不是同一字段，详见 ADR-0008。

P4 示例指标库链路已实现：`GET /api/fill-instances/{id}/metrics?period=YYYY-MM` 只向有权实例成员返回该月指标、任务 `reportPeriod` 和独立 `viewPeriod`；`PUT /api/fill-instances/{id}/bindings/{placeholderId}` 支持 `{ expectedVersion, sourceType: "MANUAL_TEXT", manualValue }` 或 `{ expectedVersion, sourceType: "DATABASE_METRIC", metricDefinitionId, metricPeriod }`。后者保存实际指标月份及来源快照，不改变任务月份。`POST /api/fill-instances/{id}/submit` 以 `{ expectedVersion }` 事务化冻结全部占位符的 SubmittedValue，缺失绑定返回 400，过期版本返回 409。

Collector 可调用 `GET /api/metrics?period=YYYY-MM`、`PUT /api/metrics/{definitionId}`（`{ period, value, expectedVersion, reason }`）和 `GET /api/metrics/{definitionId}/history?period=YYYY-MM`。当前只支持 ADR-0009 的固定测试表映射；源库版本冲突返回 409，外部更新成功但系统镜像失败返回 `SYNC_PENDING`，要求人工对账。

P4 补充 `GET /api/templates/{templateId}/slides/{slideIndex}/static-preview`，返回已移除占位符文字的 PNG；模板访问权限与常规预览相同，响应为私有缓存。`POST /api/metrics/{definitionId}/reconcile` 接收 `{ period }`，只允许 Collector；它按源库连续版本历史补齐平台镜像，响应包含 `appliedChanges`，版本缺口返回 `SYNC_HISTORY_GAP`，无新变更时幂等返回 0。

模板管理页的 `GET /api/templates` 只返回未归档模板的摘要和页数、关联任务数；`GET /api/templates/{id}` 在展开时返回该模板全部页面、占位符和预览 URL，按创建者或关联任务成员授权。`DELETE /api/templates/{id}` 仅创建者 Collector 可调用，将非解析中的模板标为 `ARCHIVED` 并写审计日志；无 Collector 角色返回 403，非创建者返回 404，解析中或状态冲突返回 409。归档不删除任务及文件，既有任务仍可读取受权预览，且归档模板不再用于创建新任务。详见 ADR-0015。

草稿预览改为 `GET /api/fill-instances/{id}/draft-preview?version={fillInstanceVersion}`，按实例权限读取已保存绑定值；版本不一致返回 409，他人实例返回 404。响应为 `image/png` 和 `private, no-store`，保存绑定后前端用新版本 URL 重新请求。

P3 任务创建请求为 `{ name, templateId, reportPeriod }`。模板必须由当前 Collector 创建且状态为 `READY`；任务关联不可变模板版本，初始状态 `DRAFT`。分配请求为 `{ expectedVersion, assignments: [{ slideId, assigneeId }] }`，表示目标全集，而非增量；成功返回任务详情和新的 `version`。同页多名 Filler 分别对应独立 FillInstance；无变化时保持版本。不可撤销已有填报痕迹的分配，详见 ADR-0005。

`POST /api/fill-instances/{id}/start` 请求为 `{ expectedVersion }`，只允许当前 assignee 将 `NOT_STARTED` 或 `RETURNED` 转为 `IN_PROGRESS`；重复或过期版本返回 409。Collector 任务详情包含总体和逐页的实例数、已开始数、已提交数与提交百分比。`GET /api/fill-instances/mine` 只返回当前 Filler 的实例；他人的实例 ID 返回 404。

`POST /api/fill-instances/{id}/submit` 成功返回 `{ instance, allAssignedPagesSubmitted }`；布尔值只统计当前填报人在同一任务中负责的页面，`SUBMITTED` 与 `REVIEWED` 视为已完成。

P5 审核：`GET /api/report-tasks/{id}/review` 返回报告月份、每页最新提交值、一致/冲突/缺失标识和当前 FinalValue；未分配但含占位符的模板页也列入审核，可由 Collector 自行填写。`PUT /api/report-tasks/{id}/final-values/{placeholderId}` 接收 `{ expectedVersion, resolutionType: "SELECTED_SUBMISSION", selectedSubmittedValueId }`、`{ expectedVersion, resolutionType: "MANUAL", valueText }` 或 `{ expectedVersion, resolutionType: "DATABASE_METRIC", metricDefinitionId, metricPeriod }`；人工值与指标值允许在 `FILLING` 或 `REVIEWING` 保存，指标服务端重读并冻结快照，采用提交值仅限 `REVIEWING`。版本是 ReportTask 版本，所选提交必须为本任务该占位符当前 revision。`POST /api/report-tasks/{id}/fill-instances/{instanceId}/return` 接收 `{ expectedVersion, reason }`，退回时清除同页 FinalValue；`POST /api/report-tasks/{id}/review` 接收 `{ expectedVersion }` 完成审核，要求全部实例已提交且**模板全部占位符**都有 FinalValue。状态或版本冲突返回 409。

P6 生成：`GET /api/report-tasks/{id}/generate` 返回任务状态/版本及已完成文件列表（PPTX、PDF、逐页 PNG，包含 SHA-256、大小、预览 URL、版式警告）。`POST /api/report-tasks/{id}/generate` 接收 `{ expectedVersion, idempotencyKey: UUID }`；仅任务 Collector 且任务为 `COMPLETED`/`EXPORTED` 可调用。相同键重试返回已完成结果，进行中/失败的键不可复用；缺少 FinalValue 返回 `MISSING_FINAL_VALUES`。生成前持久化 FinalValue、模板 SHA-256 和任务版本快照，输出与指标库后续变化无关。`POST /api/report-tasks/{id}/exports` 接收 `{ generatedFileId }`，仅对本任务已完成 PPTX/PDF 返回 `{ downloadUrl }` 并写导出审计，首次导出使任务进入 `EXPORTED`。`GET /api/files/{fileId}` 校验任务归属、文件大小和 SHA-256；PNG/PDF 默认行内预览，`?download=1` 下载，PPTX 总是下载。

### 上传模板的最小响应

```json
{
  "templateId": "...",
  "status": "READY",
  "slides": [
    {
      "slideId": "...",
      "slideIndex": 0,
      "previewFileId": "...",
      "placeholders": [
        { "id": "...", "key": "people_number", "shapeId": 7, "occurrenceIndex": 0 }
      ]
    }
  ]
}
```

## 3. PPT Service 内部 API

内部接口使用服务间密钥或网络策略保护，并接收 `X-Correlation-Id` 与 `Idempotency-Key`。路径只能是 `/data` 下的规范化相对路径，禁止调用方传任意宿主机路径。

### `GET /actuator/health/liveness`

Java 进程存活即可成功。

### `GET /actuator/health/readiness`

校验存储目录可用、LibreOffice 可执行文件存在。是否执行一次真实转换由部署配置决定，避免每次检查开销过高。

### `POST /ppt/parse`

请求：

```json
{
  "fileId": "...",
  "relativePath": "templates/.../template.pptx",
  "sha256": "..."
}
```

响应核心字段：`parserVersion`、`pageSize`、`slides[]`、`shapes[]`、`placeholders[]`、`warnings[]`。Placeholder 必须包含 key、occurrence、容器位置、run 字符范围、geometry、原始文本和样式快照。

### `POST /ppt/render`

P2 页缩略图请求包含 `fileId`、`templateId`、模板相对路径、SHA-256、`outputFormat: PNG` 和 `idempotencyKey`。响应包含 `pageCount`、`files[]` 和 `warnings[]`；每个文件记录 `slideIndex`、相对路径、MIME、大小和 SHA-256。P6 再扩展 PDF、页码范围和最终报告预览。

Web 保存每个 PNG 为 `StoredFile(PREVIEW)` 并关联 `TemplateSlide.previewFileId`。渲染输出位于 `previews/{templateId}/slide-{n}.png`，PPT Service 必须通过临时目录转换并在失败时清理已移动文件。

### `POST /ppt/render-static`

P4 内部请求包含已存模板的 `relativePath`、`sha256` 和零基 `slideIndex`，响应直接为 `image/png`。服务只在临时 PPTX 副本上移除占位符文字，原始文件保持不变；仍受内部 API Key 保护。

### `POST /ppt/render-draft`

请求包含已存模板的 `relativePath`、`sha256`、零基 `slideIndex` 和 `values: [{ key, occurrenceIndex, valueText }]`。PPT Service 在临时副本的原 TextRun 位置替换文字，验证所有给定 occurrence 确实存在，并返回该页 `image/png`；不接受客户端提供文件路径或未授权值，Web 负责实例授权与版本校验。

### `POST /ppt/generate`

请求：

```json
{
  "relativePath": "templates/{templateId}/template.pptx",
  "sha256": "64位十六进制SHA-256",
  "generationId": "UUID",
  "values": [
    { "slideIndex": 1, "key": "people_number", "occurrenceIndex": 0, "valueText": "128" }
  ]
}
```

PPT Service 严格核对每个 `(slideIndex,key,occurrenceIndex)` 是否存在且恰好提供一次；缺失或多余值均失败。原 PPTX 不修改，仅允许输出到 `generated/{generationId}/report.pptx`、`report.pdf` 和 `slide-{n}.png`。响应包含 `generationId`、`pageCount`、`files[]`（type、零基 slideIndex、relativePath、mimeType、sizeBytes、sha256）及相对于原模板新增的 `warnings[]`。权限、业务幂等和快照由 Web 处理，不由 PPT Service 推断。

## 4. MetricDataSource 接口

```ts
interface MetricDataSource {
  testConnection(): Promise<{ ok: boolean; latencyMs: number }>;
  queryMetrics(params: {
    period: string;
    metricCodes?: string[];
    search?: string;
    cursor?: string;
  }): Promise<{ items: MetricValueDto[]; nextCursor?: string }>;
  updateMetric(params: {
    metricCode: string;
    period: string;
    dimensions?: Record<string, string>;
    value: MetricScalar;
    expectedVersion?: string;
    reason: string;
  }): Promise<MetricValueDto>;
}
```

Adapter 输出统一值类型和来源版本，不向领域层泄漏供应商 SQL 类型或连接对象。
