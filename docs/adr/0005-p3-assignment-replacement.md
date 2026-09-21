# ADR-0005：P3 页面分配采用版本化集合替换

- 状态：Accepted
- 日期：2026-09-21

## 背景

Collector 需要在一页配置零个、一个或多个 Filler，多人同页必须产生隔离的 FillInstance。页面分配可能被多人同时操作；已开始填报的内容不能因取消勾选被静默删除。

## 决策

`PUT /api/report-tasks/{id}/assignments` 接收目标 `(slideId, assigneeId)` 集合与 `expectedVersion`。服务端在 Serializable 数据库事务中验证任务归属、状态、模板页面和 Filler 角色，比较当前集合并为新增项同时创建 SlideAssignment/FillInstance。每条 assignment 对应唯一实例；实例的 task、slide、assignee 冗余键在创建时与 assignment 保持一致。

只允许撤销 `NOT_STARTED` 且没有绑定、提交记录的分配。已有填报痕迹的实例拒绝撤销，不能级联删除业务数据。任务一旦进入 `FILLING`，不允许通过清空全部分配隐式回退到 `DRAFT`。集合无变化时保持版本不变；有变化时使用 `expectedVersion` 更新，冲突返回 409，并写分配审计。Filler 列表和详情由服务端按当前身份过滤，URL 猜测他人实例时返回 404。

## 后果

初期实现保持现有数据库模型，不引入复杂软删除。未来若需要在已开始填报后调整人员，应新增显式移交/作废工作流和审计，而不是放宽本接口的删除条件。P4/P5 负责后续提交、退回和审核状态迁移。
