# ADR-0011：审核 revision 与 FinalValue 的失效规则

- 日期：2026-09-22
- 状态：接受

## 背景

同页可由多人填报，退回后会出现新的提交 revision。审核时不能让旧版提交或已失效的 FinalValue 悄悄进入最终报告。

## 决策

1. 审核聚合仅展示每个已提交实例、每个占位符最新 revision 的 SubmittedValue。若有人未提交则为 `MISSING`；全部提交且文本相同为 `CONSISTENT`，否则为 `CONFLICT`。一致也不自动写 FinalValue，必须由 Collector 明确选择某个提交或手工值。
2. 审核修改、退回、完成都携带 ReportTask `expectedVersion`，用版本条件更新及同库事务保证单一线性顺序。FinalValue 自身版本也递增并记录操作审计。
3. 退回已提交实例使任务从 `REVIEWING` 回到 `FILLING`，保留历史 SubmittedValue，但删除该页此前已确定的 FinalValue，并在退回审计中记录失效内容。重新提交产生下一 revision，所有实例再次提交后回到 `REVIEWING`。
4. 完成审核要求至少有一个实例、所有实例均已提交，以及每个已分配页面的每个占位符都有 FinalValue；完成后实例进入 `REVIEWED`、任务进入 `COMPLETED`。

## 后果

- 退回某页会要求重审该页所有最终值，即使其他填报人的数据未变化。这偏保守，但能避免旧决策与新 revision 混用。
- 当前仅允许任务 Collector 审核，不存在自动仲裁或跨任务的审批人代理。
