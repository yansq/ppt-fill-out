import { scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, saltHex, hashHex] = storedHash.split(":");
  if (algorithm !== "scrypt" || !/^[0-9a-f]{32}$/.test(saltHex ?? "") || !/^[0-9a-f]{128}$/.test(hashHex ?? "")) {
    return false;
  }
  const expected = Buffer.from(hashHex, "hex");
  const actual = (await scrypt(password, Buffer.from(saltHex, "hex"), expected.length)) as Buffer;
  return timingSafeEqual(actual, expected);
}
