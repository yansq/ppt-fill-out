import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

function storageRoot(): string {
  const configuredRoot = process.env.STORAGE_ROOT?.trim();
  if (!configuredRoot) {
    throw new Error("STORAGE_ROOT is not configured");
  }
  return path.resolve(configuredRoot);
}

function resolveWithinStorage(relativePath: string): string {
  const root = storageRoot();
  const resolved = path.resolve(root, relativePath);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("Storage path escapes STORAGE_ROOT");
  }
  return resolved;
}

export async function saveTemplateFile(params: {
  buffer: Buffer;
  templateId: string;
  sha256: string;
}): Promise<string> {
  const relativePath = path.posix.join("templates", params.templateId, `${params.sha256}.pptx`);
  const destinationPath = resolveWithinStorage(relativePath);
  const temporaryPath = resolveWithinStorage(path.posix.join("temp", `${randomUUID()}.upload`));

  await mkdir(path.dirname(destinationPath), { recursive: true });
  await mkdir(path.dirname(temporaryPath), { recursive: true });
  await writeFile(temporaryPath, params.buffer, { flag: "wx", mode: 0o600 });
  try {
    await rename(temporaryPath, destinationPath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
  return relativePath;
}

export async function removeStoredFile(relativePath: string): Promise<void> {
  await unlink(resolveWithinStorage(relativePath)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}

export async function readStoredFile(relativePath: string): Promise<Buffer> {
  return readFile(resolveWithinStorage(relativePath));
}
