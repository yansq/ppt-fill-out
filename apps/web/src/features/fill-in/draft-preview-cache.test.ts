import { describe, expect, it, vi } from "vitest";

import { getCachedDraftPreview } from "./draft-preview-cache";

describe("draft preview cache", () => {
  it("shares one render for the same version and renders again for a newer version", async () => {
    const render = vi.fn(async () => ({ bytes: Buffer.from("preview"), sha256: "hash" }));

    const first = getCachedDraftPreview("instance-1:1", render);
    const duplicate = getCachedDraftPreview("instance-1:1", render);
    expect(await duplicate).toBe(await first);
    expect(render).toHaveBeenCalledOnce();

    await getCachedDraftPreview("instance-1:2", render);
    expect(render).toHaveBeenCalledTimes(2);
  });

  it("retries after a failed render", async () => {
    const render = vi.fn()
      .mockRejectedValueOnce(new Error("render failed"))
      .mockResolvedValueOnce({ bytes: Buffer.from("preview"), sha256: "hash" });

    await expect(getCachedDraftPreview("instance-2:1", render)).rejects.toThrow("render failed");
    await expect(getCachedDraftPreview("instance-2:1", render)).resolves.toMatchObject({ sha256: "hash" });
    expect(render).toHaveBeenCalledTimes(2);
  });
});
