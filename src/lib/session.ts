import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { SessionUser } from "@/lib/permissions";
import type { UserRole } from "@/constants/lookups";

/**
 * Resolve the current user from the JWT session (no DB round-trip).
 * Role/active status is refreshed in the jwt callback every ~5 minutes.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  const u = session?.user;
  if (!u?.id || !u.email || !u.role) return null;

  return {
    id: u.id,
    name: u.name || "",
    email: u.email,
    role: u.role as UserRole,
    departmentId: u.departmentId ?? null,
    managerId: u.managerId ?? null,
  };
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}
