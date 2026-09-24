import { randomUUID } from "node:crypto";

import { prisma } from "@report-platform/database";
import { z } from "zod";

import { currentActor } from "./authorization";
import { hashPassword, verifyPassword } from "./password";

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(1024),
  newPassword: z.string().min(6).max(1024).refine((value) => value.trim().length >= 6),
  confirmPassword: z.string().min(1).max(1024)
}).refine((value) => value.newPassword === value.confirmPassword, {
  message: "两次输入的新密码不一致",
  path: ["confirmPassword"]
});

export class ChangePasswordError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message);
    this.name = "ChangePasswordError";
  }
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

export async function changeOwnPassword(input: unknown) {
  const actor = await currentActor();
  const { currentPassword, newPassword } = changePasswordSchema.parse(input);
  const credential = await prisma.userCredential.findUnique({ where: { userId: actor.id } });
  if (!credential) throw new ChangePasswordError("CREDENTIAL_UNAVAILABLE", "当前账号无法修改密码", 409);
  if (credential.lockedUntil && credential.lockedUntil > new Date()) {
    throw new ChangePasswordError("ACCOUNT_LOCKED", "账号暂时锁定，请稍后再试", 429);
  }

  if (!(await verifyPassword(currentPassword, credential.passwordHash))) {
    const attempts = credential.failedAttempts + 1;
    await prisma.userCredential.updateMany({
      where: { userId: actor.id, passwordHash: credential.passwordHash, failedAttempts: credential.failedAttempts },
      data: {
        failedAttempts: attempts >= MAX_FAILED_ATTEMPTS ? 0 : attempts,
        lockedUntil: attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_MS) : null
      }
    });
    throw new ChangePasswordError("INVALID_CURRENT_PASSWORD", "当前密码错误", 400);
  }
  if (await verifyPassword(newPassword, credential.passwordHash)) {
    throw new ChangePasswordError("PASSWORD_UNCHANGED", "新密码不能与当前密码相同", 400);
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction(async (tx) => {
    const updated = await tx.userCredential.updateMany({
      where: { userId: actor.id, passwordHash: credential.passwordHash },
      data: { passwordHash, failedAttempts: 0, lockedUntil: null }
    });
    if (updated.count !== 1) throw new ChangePasswordError("CREDENTIAL_CHANGED", "密码已发生变化，请重新操作", 409);
    await tx.operationLog.create({
      data: {
        actorId: actor.id,
        action: "PASSWORD_CHANGED",
        resourceType: "UserCredential",
        resourceId: actor.id,
        correlationId: randomUUID()
      }
    });
  });
}
