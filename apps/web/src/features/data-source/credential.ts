import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const IV_BYTES = 12;
const TAG_BYTES = 16;

function encryptionKey() {
  const encoded = process.env.ENCRYPTION_KEY;
  if (!encoded || !/^[A-Za-z0-9+/]{43}=$/.test(encoded)) {
    throw new Error("ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  }
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32 || key.toString("base64") !== encoded) {
    throw new Error("ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  }
  return key;
}

export function encryptPassword(password: string) {
  const keyVersion = process.env.ENCRYPTION_KEY_VERSION?.trim() || "v1";
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(keyVersion)) throw new Error("Invalid ENCRYPTION_KEY_VERSION");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(keyVersion));
  const encrypted = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  return {
    encryptedPassword: Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64"),
    encryptionKeyVersion: keyVersion
  };
}

export function decryptPassword(encryptedPassword: string, keyVersion: string) {
  if (keyVersion !== (process.env.ENCRYPTION_KEY_VERSION?.trim() || "v1")) {
    throw new Error("Data-source key version is not available");
  }
  const payload = Buffer.from(encryptedPassword, "base64");
  if (payload.length < IV_BYTES + TAG_BYTES) throw new Error("Invalid encrypted credential");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), payload.subarray(0, IV_BYTES));
  decipher.setAAD(Buffer.from(keyVersion));
  decipher.setAuthTag(payload.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
  return Buffer.concat([decipher.update(payload.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString("utf8");
}
