type Preview = { bytes: Buffer; sha256: string };
type Entry = { promise: Promise<Preview>; expiresAt: number; byteSize: number };

const maxEntries = 24;
const maxBytes = 64 * 1024 * 1024;
const lifetimeMs = 10 * 60 * 1000;
const previews = new Map<string, Entry>();

function trimCache() {
  const now = Date.now();
  for (const [key, entry] of previews) {
    if (entry.expiresAt <= now) previews.delete(key);
  }
  let bytes = [...previews.values()].reduce(
    (total, entry) => total + entry.byteSize,
    0,
  );
  while (previews.size > maxEntries || bytes > maxBytes) {
    const oldestKey = previews.keys().next().value;
    if (oldestKey === undefined) break;
    bytes -= previews.get(oldestKey)!.byteSize;
    previews.delete(oldestKey);
  }
}

export function getCachedDraftPreview(
  key: string,
  render: () => Promise<Preview>,
): Promise<Preview> {
  trimCache();
  const cached = previews.get(key);
  if (cached) {
    previews.delete(key);
    previews.set(key, cached);
    return cached.promise;
  }
  const entry: Entry = {
    promise: Promise.resolve().then(render),
    expiresAt: Date.now() + lifetimeMs,
    byteSize: 0,
  };
  previews.set(key, entry);
  void entry.promise.then(
    (result) => {
      if (previews.get(key) === entry) {
        entry.byteSize = result.bytes.byteLength;
        trimCache();
      }
    },
    () => {
      if (previews.get(key) === entry) previews.delete(key);
    },
  );
  trimCache();
  return entry.promise;
}
