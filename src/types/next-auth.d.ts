import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/constants/lookups";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      departmentId?: string | null;
      managerId?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    departmentId?: string | null;
    managerId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
    departmentId?: string | null;
    managerId?: string | null;
    lastChecked?: number;
  }
}
