import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { verifyPassword } from "./password";

const scrypt = promisify(scryptCallback);

describe("password verification", () => {
  it("accepts matching salted scrypt hashes and rejects mismatches", async () => {
    const salt = randomBytes(16);
    const hash = (await scrypt("correct-password", salt, 64)) as Buffer;
    const stored = `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
    await expect(verifyPassword("correct-password", stored)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", stored)).resolves.toBe(false);
    await expect(verifyPassword("correct-password", "invalid-hash")).resolves.toBe(false);
  });
});
