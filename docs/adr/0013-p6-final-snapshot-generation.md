# ADR-0013：基于 FinalValue 快照生成与受控导出

- 状态：已采纳
- 日期：2026-09-22

## 背景

P4 草稿预览只能反映单个填报实例；P6 要以审核后的唯一最终值生成完整报告，且不能让指标源变化、重复请求或未授权文件访问改变已生成结果。模板中的占位符可以出现在未分配页、同页多次出现或跨 TextRun/表格中。

## 决策

1. 完成审核与生成均要求模板**所有**占位符存在 FinalValue，未分配页由 Collector 手工确定。Web 在生成前保存模板 SHA-256、任务版本、每个 FinalValue 的 ID/版本/来源和值文本快照，并以 UUID 幂等键创建 `GeneratedFile(PROCESSING)`。
2. PPT Service 只接收模板相对路径、SHA-256、生成 UUID 和按 `(slideIndex,key,occurrenceIndex)` 精确对应的值。它验证占位符覆盖，在不可变模板的临时副本中按原 TextRun 替换，转换为 PPTX、PDF 与逐页 PNG。输出限定在 `generated/{UUID}/`，临时转换失败时清理已写文件。
3. Web 在一次事务中登记全部输出的 `StoredFile`/`GeneratedFile`、哈希、大小和审计。相同已完成幂等键返回既有结果；生成失败需新键重试。只有任务 Collector 可查看生成文件；下载时再次验证哈希与大小。显式导出 PPTX/PDF 才写导出审计并把任务从 `COMPLETED` 变为 `EXPORTED`。
4. 版式告警是基于 POI 文本高度的启发式检查，只报告相对于原模板新增的疑似溢出；不能代替真实 PNG 或目标 PowerPoint 的人工检查。

## 后果

生成文件不因后续指标库变化而漂移，且每次报告可追溯到审核快照。PDF/PNG 的布局由固定 LibreOffice/字体环境决定，和 Microsoft PowerPoint 仍可能存在差异；浏览器交互回归、目标内网字体比对、容器/断公网验收及异常文件补偿仍需后续完成。PPT Service 不接触用户身份或系统库，保持原有领域边界。
