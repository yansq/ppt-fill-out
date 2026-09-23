import { prisma } from "@report-platform/database";

import { auth } from "@/auth";

export class AuthorizationError extends Error {
  constructor(
    public readonly code: "UNAUTHENTICATED" | "FORBIDDEN",
    public readonly status: 401 | 403
  ) {
    super(code === "UNAUTHENTICATED" ? "请先登录" : "无权访问该资源");
    this.name = "AuthorizationError";
  }
}

export async function currentActor() {
  const session = await auth();
  if (!session?.user?.id) throw new AuthorizationError("UNAUTHENTICATED", 401);
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      employeeNumber: true,
      username: true,
      status: true,
      roles: { select: { role: { select: { code: true } } } }
    }
  });
  if (!user || user.status !== "ACTIVE") throw new AuthorizationError("UNAUTHENTICATED", 401);
  const roles = new Set(user.roles.map(({ role }) => role.code));
  if (roles.has("COLLECTOR")) roles.add("FILLER");
  return { id: user.id, employeeNumber: user.employeeNumber, username: user.username, roles };
}

export async function requireCollector() {
  const actor = await currentActor();
  if (!actor.roles.has("COLLECTOR")) throw new AuthorizationError("FORBIDDEN", 403);
  return actor;
}

export async function requireFiller() {
  const actor = await currentActor();
  if (!actor.roles.has("FILLER")) throw new AuthorizationError("FORBIDDEN", 403);
  return actor;
}
