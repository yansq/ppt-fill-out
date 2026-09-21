import { randomBytes } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { decryptPassword, encryptPassword } from "./credential";

const previousKey = process.env.ENCRYPTION_KEY;
const previousVersion = process.env.ENCRYPTION_KEY_VERSION;

beforeEach(() => {
  process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
  process.env.ENCRYPTION_KEY_VERSION = "v1";
});

afterEach(() => {
  if (previousKey === undefined) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = previousKey;
  if (previousVersion === undefined) delete process.env.ENCRYPTION_KEY_VERSION;
  else process.env.ENCRYPTION_KEY_VERSION = previousVersion;
});

describe("data-source credentials", () => {
  it("encrypts with a unique nonce and recovers only with the matching key version", () => {
    const first = encryptPassword("example-secret");
    const second = encryptPassword("example-secret");
    expect(first.encryptedPassword).not.toBe(second.encryptedPassword);
    expect(first.encryptedPassword).not.toContain("example-secret");
    expect(decryptPassword(first.encryptedPassword, first.encryptionKeyVersion)).toBe("example-secret");
    process.env.ENCRYPTION_KEY_VERSION = "v2";
    expect(() => decryptPassword(first.encryptedPassword, first.encryptionKeyVersion)).toThrow();
  });

  it("rejects altered ciphertext and an invalid key", () => {
    const { encryptedPassword, encryptionKeyVersion } = encryptPassword("example-secret");
    const altered = Buffer.from(encryptedPassword, "base64");
    altered[altered.length - 1] ^= 1;
    expect(() => decryptPassword(altered.toString("base64"), encryptionKeyVersion)).toThrow();
    process.env.ENCRYPTION_KEY = "not-a-key";
    expect(() => encryptPassword("example-secret")).toThrow();
  });
});
