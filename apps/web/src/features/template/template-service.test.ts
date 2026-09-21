import { afterEach, describe, expect, it, vi } from "vitest";

import { listTemplates } from "./template-service";

describe("template service authorization boundary", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects the temporary P2 identity path in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await expect(listTemplates()).rejects.toMatchObject({
      code: "AUTH_NOT_IMPLEMENTED",
      status: 501
    });
  });
});
