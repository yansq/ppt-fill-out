# ADR-0024：未分配页面由收集人填写

- 日期：2026-09-29
- 状态：接受

## 背景

已有任务在 `FILLING` 阶段允许收集人直接为未分配页面保存 FinalValue，但完全没有填报人分配的任务停留在 `DRAFT`，无法进入填写与审核。未分配页面的文案也误提示必须分配填报人。

## 决策

1. 模板至少有一个占位符时，收集人可保存空分配集合，使任务从 `DRAFT` 进入 `FILLING`。不生成隐式 SlideAssignment 或 FillInstance；原本有分配的 `FILLING` 任务在撤销全部尚未开始的分配后仍保持 `FILLING`。
2. 未分配页面由任务 Collector 通过既有 FinalValue 接口写入人工值或指标快照，保持任务级版本锁、权限校验与审计。已经分配的页面继续遵守原有填报实例、提交和审核流程。
3. 完全没有 FillInstance 的任务要求全部模板占位符已有 FinalValue，才允许 Collector 显式提交自填内容并从 `FILLING` 进入 `REVIEWING`；随后允许按原有审核接口完成审核。源指标后续变化不会追改 FinalValue 快照。

## 后果

- 单人自填任务仍经过 `DRAFT → FILLING → REVIEWING → COMPLETED`，不需要虚构收集人的填报实例或 SubmittedValue。
- 任务是否完成仍以模板全部占位符的 FinalValue 为准；有填报实例时仍须所有实例提交。
