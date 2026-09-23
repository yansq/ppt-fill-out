import { prisma } from "@report-platform/database";
import { z } from "zod";

import { verifyPassword } from "./password";

const credentialsSchema = z.object({
  employeeNumber: z.string().trim().regex(/^\d{6}$/),
  password: z.string().min(1).max(1024)
});

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

export async function authenticateCredentials(input: unknown) {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) return null;

  const user = await prisma.user.findUnique({
    where: { employeeNumber: parsed.data.employeeNumber },
    include: { credential: true }
  });
  if (!user || user.status !== "ACTIVE" || !user.credential) return null;
  if (user.credential.lockedUntil && user.credential.lockedUntil > new Date()) return null;

  if (!(await verifyPassword(parsed.data.password, user.credential.passwordHash))) {
    const attempts = user.credential.failedAttempts + 1;
    await prisma.userCredential.update({
      where: { userId: user.id },
      data: {
        failedAttempts: attempts >= MAX_FAILED_ATTEMPTS ? 0 : { increment: 1 },
        lockedUntil: attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_MS) : null
      }
    });
    return null;
  }

  await prisma.userCredential.update({
    where: { userId: user.id },
    data: { failedAttempts: 0, lockedUntil: null }
  });
  return { id: user.id, name: user.name ?? user.username };
}
