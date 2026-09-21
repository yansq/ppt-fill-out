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

P3 登录入口为 Auth.js `GET/POST /api/auth/[...nextauth]`。业务 API 从服务端会话取得用户 ID，不接受调用方提交的 `actorId`。无会话返回 401，无角色返回 403；无权访问的模板及其缩略图按 404 隐藏资源存在性。

| 能力 | 建议接口 | 服务端授权 |
|---|---|---|
| 上传模板 | `POST /api/templates` | Collector |
| 查询解析状态 | `GET /api/templates/{id}` | 创建者或有权任务成员 |
| 查询模板页 | `GET /api/templates/{id}/slides` | 同上 |
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

P3 任务创建请求为 `{ name, templateId, reportPeriod }`。模板必须由当前 Collector 创建且状态为 `READY`；任务关联不可变模板版本，初始状态 `DRAFT`。分配请求为 `{ expectedVersion, assignments: [{ slideId, assigneeId }] }`，表示目标全集，而非增量；成功返回任务详情和新的 `version`。同页多名 Filler 分别对应独立 FillInstance；无变化时保持版本。不可撤销已有填报痕迹的分配，详见 ADR-0005。

`POST /api/fill-instances/{id}/start` 请求为 `{ expectedVersion }`，只允许当前 assignee 将 `NOT_STARTED` 或 `RETURNED` 转为 `IN_PROGRESS`；重复或过期版本返回 409。Collector 任务详情包含总体和逐页的实例数、已开始数、已提交数与提交百分比。`GET /api/fill-instances/mine` 只返回当前 Filler 的实例；他人的实例 ID 返回 404。

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

### `POST /ppt/generate`

请求：

```json
{
  "templateFile": { "fileId": "...", "relativePath": "templates/...pptx", "sha256": "..." },
  "values": [
    { "placeholderKey": "people_number", "value": "128" }
  ],
  "outputRelativePath": "generated/.../report.pptx",
  "idempotencyKey": "..."
}
```

响应返回生成文件元数据、未解析 key、未提供 key、重复 occurrence 数量和 layout warnings。服务不得接受或推断用户权限。

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
