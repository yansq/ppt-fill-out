# 产品与范围

## 1. 产品目标

平台不从零设计 PPT。它读取收集人提供的固定格式模板，识别显式业务占位符，将数据库指标、人工文本或经人工确认的 AI 文本绑定到占位符，并生成格式尽量保持不变的 `.pptx` 报告。

最终排版以 PowerPoint 或 LibreOffice 的真实渲染结果为准；浏览器只提供快速、近似的交互预览。

## 2. 角色与资源权限

### Collector（收集人）

- 创建周期性 `ReportTask` 并上传模板。
- 按模板页分配一个或多个 Filler。
- 查看任务内全部填报进度、绑定、提交值与冲突。
- 查询或修正指标，使用 AI 生成可编辑文本。
- 在填报中或审核中，可自行从指标库取值或人工输入，为每个占位符确定唯一 `FinalValue`；审核时也可采用填报人的提交值。
- 生成、真实预览并导出最终 PPT。

### Filler（填报人）

- 只能访问 `assigneeId` 为自己的 `FillInstance`。
- 查看被分配页、报告月份与可切换的历史月份数据。
- 将占位符绑定到指标或录入人工文本。
- 在权限允许时修正指标，并留下独立的修改历史。
- 查看快速预览并提交自己的填报结果。

角色只表示能力集合。所有读写都必须在服务端执行资源级授权，不能依赖前端隐藏。

## 3. 不可混淆的业务概念

- `ReportTemplate`：上传的不可变模板版本；原始 PPTX 不因任务或填报而修改。
- `TemplateSlide`：模板中的不可变页面定义。
- `TemplatePlaceholder`：通过 `{{key}}` 表示的业务占位符，不等同于 PowerPoint 原生 Placeholder。
- `ReportTask`：某模板在某个 `reportPeriod` 下的一次报告任务。
- `FillInstance`：某个模板页分配给某个填报人后形成的独立填报实例。多人负责同一页时创建多个实例，不复制 PPT 文件。
- `PlaceholderBinding`：某个 FillInstance 内，占位符与值来源之间的绑定。

## 4. PPT 模板与解析规则

业务占位符语法为 `{{placeholder_key}}`，首版支持：

- 普通 Text Shape；
- 一段文字中的一个或多个占位符；
- 跨多个 TextRun 的占位符；
- Table Cell 中的占位符。

解析结果至少记录：页码、shape id/name/type、paragraph/run 或 table cell 定位、key、原始文本、x/y/width/height、文本及段落样式。模板解析结果必须可复现，并与模板文件哈希关联。

首版明确不支持：动态图表数据替换、复杂动态表格扩行、动态新增页、OCR、PPT 在线自由编辑。

## 5. 值与冲突规则

### 5.1 来源类型

`ValueSourceType` 首版支持：

- `DATABASE_METRIC`
- `MANUAL_TEXT`
- `AI_GENERATED`（仅 Collector 可发起；结果必须先成为可编辑文本）

枚举预留：`EXPRESSION`、`API`。预留仅体现在类型和模型的可扩展性，不提供伪实现。

### 5.2 三级 Value

- `SourceValue`：从外部指标源查询到的原始值及其来源快照。
- `SubmittedValue`：Filler 提交时冻结的值；提交后不随指标源静默变化。
- `FinalValue`：Collector 在填报中或审核中确定的最终值，可来源于指标、人工输入或填报人的提交；生成 PPT 只读取 FinalValue。

同页多人对同一占位符提交不同值时，系统必须展示冲突。Collector 可选择某一提交值或手工输入，系统不得自动覆盖或无提示合并。

## 6. 报告周期

- `ReportTask.reportPeriod` 使用 `YYYY-MM`。
- 指标默认按报告周期查询。
- `reportPeriod` 与 UI 中的 `viewPeriod` 是不同概念；切换查看月份不能修改任务月份。
- 绑定非报告月份的指标时必须明确提示，并在绑定或提交快照中保留实际指标月份。

## 7. 工作流与状态机

### FillInstance

`NOT_STARTED -> IN_PROGRESS -> SUBMITTED -> REVIEWED`

退回路径：`SUBMITTED -> RETURNED -> IN_PROGRESS`。任何状态迁移都校验当前状态、操作者权限和版本号，并记录操作日志。

### ReportTask

`DRAFT -> FILLING -> REVIEWING -> COMPLETED -> EXPORTED`

进入 `COMPLETED` 前，每个需要填报的占位符都必须存在已确认 FinalValue，或被明确标记为允许留空。

## 8. 核心页面

### 任务分发页

- 创建任务、上传/选择模板、展示页缩略图。
- 填报人始终同时展示姓名与 6 位工号，并可按姓名或工号搜索。
- 每页配置零个、一个或多个填报人，并据此创建/撤销 FillInstance。
- 展示任务状态、页面状态和总体进度。

### 模板管理页

- 默认展示模板摘要列表；用户选择某个模板后才加载该模板每页的预览和占位符。
- 模板创建者可删除模板，使其不再出现在目录或新任务选择中；已使用该模板的任务、审计与文件保持可访问。

### 填报页

- 当前 FillInstance 对应页的 PPT 预览。
- 占位符列表与来源绑定：数据库指标、人工输入；Collector 额外拥有 AI 生成入口。
- 按月份加载、搜索、筛选指标；授权用户可修改指标并填写原因。
- 修改绑定或值后即时刷新 Fast Preview；提交前校验缺失值、历史月份绑定和版本冲突。

### 审核页

- 布局与填报页一致：左侧为页面缩略图导航，PPT 页面预览为中间主体，当前页的提交值与审核操作置于右侧。
- 报告任务处于“填报中”时沿用同一逐页三栏布局展示填报状态；调整页面分配置于可展开区域，不挡住逐页预览。
- 按页、占位符并列展示所有 SubmittedValue。
- 明确标识一致、冲突、缺失和潜在文本溢出。
- Collector 选择或编辑 FinalValue，触发真实预览并完成任务。

## 9. 预览与溢出

- Fast Preview：静态页背景图 + 根据 shape 几何和样式定位的 HTML 动态文字/表格，用于实时反馈，不承诺像素级一致。
- Real Preview：模板 + 当前/最终值生成临时 PPTX，再由 LibreOffice Headless 转成 PDF/PNG。
- Shape 尺寸默认不可改变。处理顺序为保持字号、允许换行、按规则缩小至最小字号、仍溢出则标记异常；不得静默移动其他元素。

## 10. 数据源与 AI

- 系统数据库和指标数据源解耦。首版实现 `MySQLMetricDataSource`，统一接口支持查询、更新和连接测试。
- 数据源密码必须加密存储，密钥由运行环境注入；日志和 API 响应不得返回密文或明文密码。
- AI 使用 Vercel AI SDK 与 OpenAI-Compatible 配置，Provider、Base URL、Key、Model 均来自配置。
- AI 只生成文本候选，不读写 PPT、不直接形成 FinalValue；生成、编辑、确认过程均可审计。

## 11. 文件与审计

- PPT、预览和生成文件保存在 `/data/templates`、`/data/previews`、`/data/generated`、`/data/temp`；数据库只保存元数据和哈希，不保存 BLOB。
- 文件必须通过有权限校验的 API 或受控资源路由访问，不公开整个 `/data`。
- 上传模板、创建任务、分配填报人、修改指标、提交、退回、修改 FinalValue、AI 生成、导出均写 `operation_logs`。
- 指标修改另写 `metric_value_history`，包含旧值、新值、操作者、原因和时间。

## 12. MVP 成功标准

完整链路可运行：登录 -> 上传 PPTX -> 解析并持久化占位符 -> 创建带报告周期的任务 -> 分配页面 -> Filler 绑定指标/人工文本 -> Fast Preview -> 提交 -> Collector 冲突处理并确认 FinalValue -> Apache POI 生成 PPTX -> LibreOffice Real Preview -> 下载。

首个工程里程碑先完成“上传、存储、解析、持久化、列表展示”的 Vertical Slice，验证后才进入任务分发。

## 13. 首版非目标

不引入 Redis、Kafka、RabbitMQ、Kubernetes、Elasticsearch、服务注册中心、Redux、多人实时共同编辑、OCR 或任意 PPT 在线编辑。PPT 生成可同步执行，但调用边界应允许未来替换为异步任务。
