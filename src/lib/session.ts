import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import type { SessionUser } from "@/lib/permissions";
import { User } from "@/models/User";
import type { UserRole } from "@/constants/lookups";

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && !session?.user?.id) return null;

  // Always resolve from DB so reseed / id changes don't break task filters
  await connectDB();
  const dbUser = session.user.email
    ? await User.findOne({ email: session.user.email.toLowerCase(), active: true })
    : await User.findById(session.user.id);

  if (!dbUser) return null;

  return {
    id: dbUser._id.toString(),
    name: dbUser.name,
    email: dbUser.email,
    role: dbUser.role as UserRole,
    departmentId: dbUser.departmentId?.toString() ?? null,
    managerId: dbUser.managerId?.toString() ?? null,
  };
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}
