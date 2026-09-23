# 领域与数据模型

本文是 Prisma 初始模型的设计基线；字段名可在实现时微调，但概念边界、唯一约束和权限关系不得被弱化。

## 1. 核心关系

```text
User --< UserRole >-- Role
User --< ReportTask (collector)
ReportTemplate --< TemplateSlide --< TemplatePlaceholder
ReportTemplate --< ReportTask --< SlideAssignment --1 FillInstance
User (assignee) --< FillInstance
FillInstance --< PlaceholderBinding
FillInstance --< SubmittedValue
ReportTask --< FinalValue
DataSource --< MetricDefinition --< MetricValue --< MetricValueHistory
ReportTask --< GeneratedFile
User --< OperationLog
```

`TemplateSlide` 到 `FillInstance` 是一对多。`FinalValue` 属于任务和模板占位符，不属于某个 Filler。

## 2. 建议实体

### 认证与权限

- `User(id, employeeNumber, username, email?, name, status, createdAt, updatedAt)`；employeeNumber 为唯一的 6 位数字工号并用于登录，username 保留为唯一的人员名称，email 可选、填写时唯一。既有用户迁移时按创建顺序回填唯一工号。
- `Role(id, code, name)`；code 唯一，首版为 `COLLECTOR`、`FILLER`。
- `UserRole(userId, roleId)`；复合唯一键。
- P3 Credentials 身份源使用 `UserCredential(userId, passwordHash, failedAttempts, lockedUntil, updatedAt)`；密码与业务 User 分表。Auth.js 当前使用 JWT 会话，Account/Session/VerificationToken 为未来 OAuth/数据库会话保留。

### 模板

- `ReportTemplate(id, name, version, status, sourceFileId, sha256, parserVersion, createdById, createdAt)`。
- `TemplateSlide(id, templateId, slideIndex, widthEmu, heightEmu, previewFileId, metadataJson)`；`(templateId, slideIndex)` 唯一。
- `TemplatePlaceholder(id, slideId, key, occurrenceIndex, shapeId, shapeName, shapeType, containerType, paragraphIndex, startRunIndex, startOffset, endRunIndex, endOffset, tableRow, tableColumn, xEmu, yEmu, widthEmu, heightEmu, originalText, styleJson)`；`(slideId, key, occurrenceIndex)` 唯一。

模板记录一旦被任务引用即不可原地修改；重新上传产生新版本。
用户删除模板时将状态改为 `ARCHIVED` 并从模板目录与新任务选择中隐藏；既有任务仍保留不可变模板、页面和文件引用，并可继续受权预览、生成与导出。版本号不因归档而复用，详见 ADR-0015。

### 任务与分配

- `ReportTask(id, name, templateId, reportPeriod, status, collectorId, version, createdAt, updatedAt)`；索引 `(collectorId, status)`、`reportPeriod`。
- `SlideAssignment(id, taskId, templateSlideId, assigneeId, createdById, createdAt)`；`(taskId, templateSlideId, assigneeId)` 唯一。
- `FillInstance(id, assignmentId, taskId, templateSlideId, assigneeId, status, version, submittedAt, reviewedAt, createdAt, updatedAt)`；assignmentId 唯一；索引 `(assigneeId, status)`、`(taskId, status)`。

冗余保存 task/slide/assignee 外键用于权限查询效率，但创建时必须验证与 assignment 一致。
P3 采用 `expectedVersion` 的目标分配集合替换；每个 `(taskId, templateSlideId, assigneeId)` 只对应一个 FillInstance。已有填报痕迹的实例不能被该接口删除，详见 ADR-0005。

### 绑定与三级值

- `PlaceholderBinding(id, fillInstanceId, placeholderId, sourceType, metricDefinitionId?, metricPeriod?, manualValue?, sourceSnapshotJson?, aiGenerationId?, formatOptionsJson?, version, updatedById, updatedAt)`；`(fillInstanceId, placeholderId)` 唯一。P4 的 `sourceSnapshotJson` 固定绑定时实际指标值、月份、来源版本与更新时间/人。
- `SubmittedValue(id, fillInstanceId, placeholderId, valueText, sourceType, sourceSnapshotJson, bindingSnapshotJson, submittedById, submittedAt, submissionRevision)`；`(fillInstanceId, placeholderId, submissionRevision)` 唯一。
- `FinalValue(id, taskId, placeholderId, valueText, resolutionType, selectedSubmittedValueId?, sourceSnapshotJson?, version, decidedById, decidedAt, updatedAt)`；`(taskId, placeholderId)` 唯一。
- `FinalResolutionType` 包含 `DATABASE_METRIC`、`MANUAL`、`SELECTED_SUBMISSION`；前两种允许 Collector 在 `FILLING` 保存，指标值同时冻结来源快照，采用提交值仅限 `REVIEWING`。

`resolutionType` 至少包含 `SELECTED_SUBMISSION`、`MANUAL`。数据库不把 SourceValue 只存成可变外键；SubmittedValue/FinalValue 必须带足以审计的不可变快照。

### 指标数据源

- `DataSource(id, name, type, status, host, port, databaseName, username, encryptedPassword, encryptionKeyVersion, optionsJson, createdById, createdAt, updatedAt)`；name 唯一。
- `MetricDefinition(id, dataSourceId, code, name, description, valueType, unit, writable, queryConfigJson, updateConfigJson, createdAt, updatedAt)`；`(dataSourceId, code)` 唯一。
- `MetricValue(id, metricDefinitionId, period, dimensionsHash, dimensionsJson, valueText, valueNumber?, sourceUpdatedAt?, version, fetchedAt)`；`(metricDefinitionId, period, dimensionsHash)` 唯一。
- `MetricValueHistory(id, metricValueId, oldValueJson, newValueJson, reason, operatorId, expectedVersion, createdAt)`；索引 `(metricValueId, createdAt)`。

若外部指标库是真实数据源，`MetricValue` 可作为受控缓存/镜像；Adapter 的更新与本地 history 写入需要清晰的失败状态，禁止伪装成跨库原子事务。

### 文件、AI 与审计

- `StoredFile(id, category, storagePath, originalFilename, mimeType, sizeBytes, sha256, createdById, createdAt)`；`storagePath` 唯一，`(sha256, category)` 建索引。
- `GeneratedFile(id, taskId, type, status, storedFileId?, valuesSnapshotJson, idempotencyKey, errorCode?, createdById, createdAt, completedAt)`；idempotencyKey 唯一。
- `AiGeneration(id, taskId, placeholderId?, promptTemplateKey, inputSnapshotJson, provider, model, outputText, acceptedText?, createdById, createdAt)`。
- `OperationLog(id, actorId, action, resourceType, resourceId, taskId?, beforeJson?, afterJson?, metadataJson?, correlationId, createdAt)`；索引 `(resourceType, resourceId, createdAt)`、`(taskId, createdAt)`。

## 3. 强约束与不变量

- reportPeriod/metricPeriod 在 API 层和数据库层约束为 `YYYY-MM` 语义。
- FillInstance 的 task、slide、assignee 必须与 SlideAssignment 一致。
- Binding 的 placeholder 必须属于 FillInstance 对应的 TemplateSlide。
- SubmittedValue 只能由该 FillInstance 的 assignee 提交；提交事务覆盖该 revision 的全部必填占位符。
- FinalValue 的 placeholder 必须来自 ReportTask 使用的模板；生成时只读取 FinalValue。
- 不删除已被任务、提交、生成文件或审计引用的模板和文件元数据；采用状态归档。
- 所有 `Json` 字段在应用边界使用 Zod/JSON Schema 校验，不将 `Json` 当作逃避建模的手段。

## 4. 并发策略

- `ReportTask`、`FillInstance`、`PlaceholderBinding`、`FinalValue`、`MetricValue` 包含递增 `version`。
- 更新条件包含 `id + expectedVersion`；影响行数为 0 时返回 `409 VERSION_CONFLICT` 和最新摘要。
- 提交后编辑需先退回；审核已变更的 submission revision 时拒绝保存，要求刷新。
- 指标外部更新成功而本地 history 失败时记录可恢复的 reconciliation 状态和操作日志，不能返回完全成功。
