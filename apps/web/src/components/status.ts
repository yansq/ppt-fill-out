export const taskStatusText: Record<string, string> = {
  DRAFT: "待分配",
  FILLING: "填报中",
  REVIEWING: "待审核",
  COMPLETED: "待生成",
  EXPORTED: "已导出"
};

export const instanceStatusText: Record<string, string> = {
  NOT_STARTED: "待开始",
  IN_PROGRESS: "填写中",
  SUBMITTED: "待审核",
  RETURNED: "已退回",
  REVIEWED: "已审核"
};

export const templateStatusText: Record<string, string> = {
  PARSING: "解析中",
  READY: "可使用",
  PARSE_FAILED: "解析失败"
};

export function taskNextStep(status: string) {
  return ({
    DRAFT: "分配页面给填报人",
    FILLING: "跟进填报进度",
    REVIEWING: "确认每项最终值",
    COMPLETED: "生成并检查报告",
    EXPORTED: "查看或再次下载报告"
  } as Record<string, string>)[status] ?? "查看任务";
}
