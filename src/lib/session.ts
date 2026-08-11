import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getManagedDepartmentIds } from "@/lib/departments";
import type { SessionUser } from "@/lib/permissions";
import type { UserRole } from "@/constants/lookups";
import { connectDB } from "@/lib/db";

/**
 * Resolve the current user from the JWT session.
 * For managers, ensures departmentIds are loaded from Department.managerId.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  const u = session?.user;
  if (!u?.id || !u.email || !u.role) return null;

  const user: SessionUser = {
    id: u.id,
    name: u.name || "",
    email: u.email,
    role: u.role as UserRole,
    departmentId: u.departmentId ?? null,
    departmentIds: Array.isArray(u.departmentIds)
      ? u.departmentIds
      : u.departmentId
        ? [u.departmentId]
        : [],
    managerId: u.managerId ?? null,
  };

  if (user.role === "manager") {
    try {
      await connectDB();
      const ids = await getManagedDepartmentIds(user.id);
      if (ids.length > 0) {
        user.departmentIds = ids;
        if (!user.departmentId || !ids.includes(user.departmentId)) {
          user.departmentId = ids[0];
        }
      }
    } catch {
      // keep JWT values
    }
  }

  return user;
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}
