import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

import { PrismaClient } from "@prisma/client";

const scrypt = promisify(scryptCallback);
const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction([
    prisma.role.upsert({
      where: { code: "COLLECTOR" },
      create: { code: "COLLECTOR", name: "收集人" },
      update: { name: "收集人" }
    }),
    prisma.role.upsert({
      where: { code: "FILLER" },
      create: { code: "FILLER", name: "填报人" },
      update: { name: "填报人" }
    })
  ]);

  const username = process.env.AUTH_SEED_USERNAME?.trim().toLowerCase();
  const password = process.env.AUTH_SEED_PASSWORD;
  const roleCode = process.env.AUTH_SEED_ROLE?.trim().toUpperCase();
  if (!username && !password && !roleCode) {
    process.stdout.write("COLLECTOR/FILLER roles seeded. Set AUTH_SEED_USERNAME, AUTH_SEED_PASSWORD and AUTH_SEED_ROLE to provision one user.\n");
    return;
  }
  if (!username || !password || !["COLLECTOR", "FILLER"].includes(roleCode)) {
    throw new Error("Set AUTH_SEED_USERNAME, AUTH_SEED_PASSWORD and AUTH_SEED_ROLE=COLLECTOR|FILLER together");
  }
  const minimumPasswordLength = process.env.AUTH_SEED_ALLOW_WEAK_PASSWORD === "1" ? 6 : 12;
  if (username.length > 191 || /\s/.test(username) || password.length < minimumPasswordLength) {
    throw new Error(`AUTH_SEED_USERNAME must be 1-191 non-whitespace characters and AUTH_SEED_PASSWORD must have at least ${minimumPasswordLength} characters`);
  }

  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(password, Buffer.from(salt, "hex"), 64)).toString("hex");
  await prisma.$transaction(async (tx) => {
    const role = await tx.role.findUniqueOrThrow({ where: { code: roleCode } });
    const user = await tx.user.upsert({
      where: { username },
      create: { username, name: username },
      update: { status: "ACTIVE" }
    });
    await tx.userCredential.upsert({
      where: { userId: user.id },
      create: { userId: user.id, passwordHash: `scrypt:${salt}:${hash}` },
      update: { passwordHash: `scrypt:${salt}:${hash}`, failedAttempts: 0, lockedUntil: null }
    });
    await tx.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      create: { userId: user.id, roleId: role.id },
      update: {}
    });
  });
  process.stdout.write(`Provisioned ${username} as ${roleCode}.\n`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
