import yauzl, { type Entry, type ZipFile } from "yauzl";

const MAX_ZIP_ENTRIES = 10_000;
const MAX_UNCOMPRESSED_BYTES = 500 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 100;
const REQUIRED_PARTS = new Set(["[Content_Types].xml", "ppt/presentation.xml"]);

export class PptxValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PptxValidationError";
  }
}

function openZip(buffer: Buffer): Promise<ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, autoClose: true }, (error, zipFile) => {
      if (error || !zipFile) {
        reject(new PptxValidationError("文件不是有效的 PPTX/ZIP 包"));
        return;
      }
      resolve(zipFile);
    });
  });
}

function validateEntryPath(entry: Entry) {
  const name = entry.fileName.replaceAll("\\", "/");
  const pathParts = name.split("/");
  if (name.startsWith("/") || pathParts.includes("..")) {
    throw new PptxValidationError("PPTX 包含不安全的文件路径");
  }
  if ((entry.generalPurposeBitFlag & 0x1) !== 0) {
    throw new PptxValidationError("不支持加密的 PPTX 文件");
  }
}

export async function validatePptxPackage(buffer: Buffer): Promise<void> {
  const zipFile = await openZip(buffer);

  await new Promise<void>((resolve, reject) => {
    let entryCount = 0;
    let totalUncompressedBytes = 0;
    const discoveredParts = new Set<string>();
    let settled = false;

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      zipFile.close();
      reject(error);
    };

    zipFile.on("entry", (entry: Entry) => {
      try {
        validateEntryPath(entry);
        entryCount += 1;
        totalUncompressedBytes += entry.uncompressedSize;
        discoveredParts.add(entry.fileName.replaceAll("\\", "/"));

        if (entryCount > MAX_ZIP_ENTRIES) {
          throw new PptxValidationError("PPTX 包含过多文件条目");
        }
        if (totalUncompressedBytes > MAX_UNCOMPRESSED_BYTES) {
          throw new PptxValidationError("PPTX 解压后大小超过安全限制");
        }
        if (buffer.length > 0 && totalUncompressedBytes / buffer.length > MAX_COMPRESSION_RATIO) {
          throw new PptxValidationError("PPTX 压缩比超过安全限制");
        }
        zipFile.readEntry();
      } catch (error) {
        fail(error instanceof Error ? error : new PptxValidationError("PPTX 校验失败"));
      }
    });

    zipFile.on("error", (error) => fail(new PptxValidationError(`PPTX 包读取失败：${error.message}`)));
    zipFile.on("end", () => {
      if (settled) return;
      const missingParts = [...REQUIRED_PARTS].filter((part) => !discoveredParts.has(part));
      if (missingParts.length > 0) {
        fail(new PptxValidationError(`PPTX 缺少必要部件：${missingParts.join(", ")}`));
        return;
      }
      settled = true;
      resolve();
    });

    zipFile.readEntry();
  });
}

