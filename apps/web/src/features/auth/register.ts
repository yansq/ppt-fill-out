import { randomUUID } from "node:crypto";

import { Prisma, prisma } from "@report-platform/database";
import { z } from "zod";

import { employeeNumberSchema } from "./employee-account";
import { hashPassword } from "./password";

export const registerSchema = z.object({
  employeeNumber: z.string().trim().regex(employeeNumberSchema),
  name: z.string().trim().min(1).max(80),
  password: z.string().min(6).max(1024).refine((value) => value.trim().length >= 6),
  confirmPassword: z.string().min(1).max(1024)
}).refine((value) => value.password === value.confirmPassword, {
  message: "两次输入的密码不一致",
  path: ["confirmPassword"]
});

export class RegistrationError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message);
    this.name = "RegistrationError";
  }
}

export async function registerFiller(input: unknown) {
  const { employeeNumber, name, password } = registerSchema.parse(input);
  const passwordHash = await hashPassword(password);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const fillerRole = await tx.role.findUnique({ where: { code: "FILLER" }, select: { id: true } });
        if (!fillerRole) throw new RegistrationError("ROLE_UNAVAILABLE", "填报人角色尚未配置", 503);
        const existing = await tx.user.findUnique({
          where: { employeeNumber },
          include: { credential: { select: { userId: true } }, roles: { select: { role: { select: { code: true } } } } }
        });
        if (existing?.status === "DISABLED") throw new RegistrationError("ACCOUNT_DISABLED", "该工号已停用，请联系管理员", 409);
        if (existing?.credential) throw new RegistrationError("ALREADY_REGISTERED", "该工号已注册，请直接登录", 409);
        if (existing?.roles.some(({ role }) => role.code === "COLLECTOR")) {
          throw new RegistrationError("ACCOUNT_RESERVED", "该账号不能通过填报人注册开通", 409);
        }

        const user = existing ? await tx.user.update({
          where: { id: existing.id },
          data: {
            name: existing.name ?? name,
            ...(existing.username.startsWith(`pending-${employeeNumber}-`) ? { username: `${name}-${employeeNumber}` } : {})
          }
        }) : await tx.user.create({
          data: { employeeNumber, username: `${name}-${employeeNumber}`, name, status: "ACTIVE" }
        });
        await tx.userRole.upsert({
          where: { userId_roleId: { userId: user.id, roleId: fillerRole.id } },
          create: { userId: user.id, roleId: fillerRole.id },
          update: {}
        });
        await tx.userCredential.create({ data: { userId: user.id, passwordHash } });
        await tx.operationLog.create({
          data: {
            actorId: user.id,
            action: "FILLER_REGISTERED",
            resourceType: "User",
            resourceId: user.id,
            correlationId: randomUUID()
          }
        });
        return { employeeNumber: user.employeeNumber };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2034")) {
        if (attempt === 0) continue;
        throw new RegistrationError("REGISTRATION_CONFLICT", "账号信息发生冲突，请重试", 409);
      }
      throw error;
    }
  }
  throw new RegistrationError("REGISTRATION_CONFLICT", "账号信息发生冲突，请重试", 409);
}
