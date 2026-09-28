import type { SampleReplacement, SampleSegment } from "./ppt-service-client";
import { TemplateUploadError } from "./template-error";

function sameSegment(a: SampleSegment, b: SampleSegment) {
  return a.slideIndex === b.slideIndex && a.shapeId === b.shapeId
    && a.tableRow === b.tableRow && a.tableColumn === b.tableColumn
    && a.paragraphIndex === b.paragraphIndex && a.text === b.text;
}

export function validateReplacements(segments: SampleSegment[], replacements: SampleReplacement[]) {
  for (const item of replacements) {
    if (!segments.some((segment) => sameSegment(segment, item.segment))) {
      throw new TemplateUploadError("VALIDATION_ERROR", "样例内容已变化，请重新生成候选", 400);
    }
    const text = item.segment.text;
    const start = text.indexOf(item.originalText);
    if (start < 0 || text.indexOf(item.originalText, start + 1) !== -1) {
      throw new TemplateUploadError("VALIDATION_ERROR", "被替换文字必须在对应段落中恰好出现一次", 400);
    }
    const conflicting = replacements.filter((other) => sameSegment(other.segment, item.segment) && other !== item);
    if (conflicting.some((other) => {
      const otherStart = text.indexOf(other.originalText);
      return start < otherStart + other.originalText.length && otherStart < start + item.originalText.length;
    })) {
      throw new TemplateUploadError("VALIDATION_ERROR", "同一段落的替换范围不能重叠", 400);
    }
  }
}
