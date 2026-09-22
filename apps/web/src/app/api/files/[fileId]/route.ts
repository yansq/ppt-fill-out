import { createHash } from "node:crypto";

import { prisma } from "@report-platform/database";
import { NextResponse } from "next/server";

import { requireCollector } from "@/features/auth/authorization";
import { generationErrorResponse } from "@/features/generation/http-error";
import { GenerationError } from "@/features/generation/generation-service";
import { readStoredFile } from "@/features/template/storage";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ fileId: string }> }) {
  try {
    const actor = await requireCollector();
    const { fileId } = await context.params;
    const generated = await prisma.generatedFile.findFirst({
      where: { storedFileId: fileId, status: "COMPLETED", task: { collectorId: actor.id } },
      include: { storedFile: true }
    });
    if (!generated?.storedFile) throw new GenerationError("NOT_FOUND", "文件不存在", 404);
    const bytes = await readStoredFile(generated.storedFile.storagePath);
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (digest !== generated.storedFile.sha256 || BigInt(bytes.length) !== generated.storedFile.sizeBytes) {
      throw new GenerationError("FILE_CORRUPTED", "生成文件校验失败", 503);
    }
    const filename = generated.type === "PPTX" ? `report-${generated.taskId}.pptx`
      : generated.type === "PDF" ? `report-${generated.taskId}.pdf`
      : `slide-${(generated.valuesSnapshotJson as { slideIndex?: number }).slideIndex! + 1}.png`;
    const disposition = generated.type === "PPTX" || new URL(request.url).searchParams.get("download") === "1"
      ? "attachment" : "inline";
    return new NextResponse(new Uint8Array(bytes), { headers: {
      "Content-Type": generated.storedFile.mimeType,
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      ETag: `"${digest}"`
    } });
  } catch (error) {
    return generationErrorResponse(error);
  }
}
