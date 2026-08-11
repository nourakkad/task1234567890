import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getManagedDepartmentIds } from "@/lib/departments";
import { getAuthSecret } from "@/lib/env";
import { connectDB } from "@/lib/db";
import {
  clearFailedLogins,
  isLoginLocked,
  registerFailedLogin,
} from "@/lib/loginGuard";
import { User } from "@/models/User";
import type { UserRole } from "@/constants/lookups";

const SESSION_MAX_AGE_SEC = 8 * 60 * 60; // 8 hours
const TOKEN_REFRESH_MS = 15 * 60 * 1000; // re-check DB at most every 15 min

async function departmentIdsForUser(
  role: string,
  userId: string,
  fallbackDeptId: string | null
): Promise<string[]> {
  if (role === "manager") {
    const ids = await getManagedDepartmentIds(userId);
    if (ids.length > 0) return ids;
  }
  return fallbackDeptId ? [fallbackDeptId] : [];
}

export const authOptions: NextAuthOptions = {
  secret: getAuthSecret(),
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SEC,
  },
  useSecureCookies: process.env.NODE_ENV === "production",
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;

        const email = credentials.email.trim().toLowerCase();
        if (!email || credentials.password.length > 200) return null;

        await connectDB();
        const user = await User.findOne({
          email,
          active: true,
        });
        // Dummy compare when user missing — reduces trivial timing enumeration
        if (!user) {
          await bcrypt.compare(
            credentials.password,
            "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"
          );
          return null;
        }

        if (isLoginLocked(user)) {
          return null;
        }

        const valid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );
        if (!valid) {
          await registerFailedLogin(user);
          return null;
        }

        await clearFailedLogins(user);

        const departmentId = user.departmentId?.toString() ?? null;
        const departmentIds = await departmentIdsForUser(
          user.role,
          user._id.toString(),
          departmentId
        );

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role as UserRole,
          departmentId,
          departmentIds,
          managerId: user.managerId?.toString() ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.departmentId = user.departmentId ?? null;
        token.departmentIds = user.departmentIds ?? [];
        token.managerId = user.managerId ?? null;
        token.email = user.email;
        token.lastChecked = Date.now();
        return token;
      }

      // Periodically refresh role/active status (serverless-friendly)
      const lastChecked = Number(token.lastChecked || 0);
      const needsRefresh =
        !lastChecked || Date.now() - lastChecked > TOKEN_REFRESH_MS;

      if (needsRefresh && token.email) {
        try {
          await connectDB();
          const dbUser = await User.findOne({
            email: String(token.email).toLowerCase(),
            active: true,
          });
          if (!dbUser || isLoginLocked(dbUser)) {
            delete token.id;
            delete token.email;
            delete token.role;
            delete token.departmentId;
            delete token.departmentIds;
            delete token.managerId;
            return token;
          }
          token.id = dbUser._id.toString();
          token.role = dbUser.role as UserRole;
          token.departmentId = dbUser.departmentId?.toString() ?? null;
          token.departmentIds = await departmentIdsForUser(
            dbUser.role,
            dbUser._id.toString(),
            token.departmentId ?? null
          );
          token.managerId = dbUser.managerId?.toString() ?? null;
          token.name = dbUser.name;
          token.lastChecked = Date.now();
        } catch {
          // keep existing token if DB temporarily unavailable
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (!token?.id || !token.email) {
        return session;
      }
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.departmentId =
          (token.departmentId as string | null) ?? null;
        session.user.departmentIds = Array.isArray(token.departmentIds)
          ? (token.departmentIds as string[])
          : session.user.departmentId
            ? [session.user.departmentId]
            : [];
        session.user.managerId = (token.managerId as string | null) ?? null;
        if (token.name) session.user.name = token.name as string;
      }
      return session;
    },
  },
};
