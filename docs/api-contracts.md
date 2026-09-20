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

| 能力 | 建议接口 | 服务端授权 |
|---|---|---|
| 上传模板 | `POST /api/templates` | Collector |
| 查询解析状态 | `GET /api/templates/{id}` | 创建者或有权任务成员 |
| 查询模板页 | `GET /api/templates/{id}/slides` | 同上 |
| 创建任务 | `POST /api/report-tasks` | Collector |
| 分配页面 | `PUT /api/report-tasks/{id}/assignments` | 任务 Collector |
| 我的填报实例 | `GET /api/fill-instances/mine` | 当前用户 |
| 填报详情 | `GET /api/fill-instances/{id}` | assignee 或任务 Collector |
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

请求包含输入文件引用、输出格式 `PNG|PDF`、可选页码范围和 idempotencyKey。响应返回生成文件的相对路径、MIME、大小、SHA-256、页数和 warnings。

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

