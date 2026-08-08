"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { ROLE_LABELS, type UserRole } from "@/constants/lookups";

const LINKS: Array<{
  href: string;
  label: string;
  roles?: UserRole[];
}> = [
  { href: "/dashboard", label: "لوحة المتابعة", roles: ["ceo", "manager"] },
  { href: "/track", label: "متابعة مهام المدراء", roles: ["ceo"] },
  {
    href: "/employee-review",
    label: "متابعة مهام الموظفين",
    roles: ["ceo"],
  },
  { href: "/tasks/new", label: "إسناد مهمة", roles: ["ceo", "manager"] },
  {
    href: "/team",
    label: "إدارة الفريق",
    roles: ["ceo", "manager"],
  },
  {
    href: "/manager-tasks",
    label: "مهام من الإدارة",
    roles: ["manager"],
  },
  {
    href: "/team-tasks",
    label: "متابعة الفريق",
    roles: ["manager"],
  },
  {
    href: "/my-tasks",
    label: "مهامي",
    roles: ["employee"],
  },
  {
    href: "/account",
    label: "حسابي",
    roles: ["ceo", "manager", "employee"],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data } = useSession();
  const role = data?.user?.role;

  return (
    <aside className="fixed inset-y-0 start-0 z-40 flex w-64 flex-col bg-[var(--sidebar)] text-[var(--sidebar-ink)]">
      <div className="shrink-0 border-b border-white/10 px-5 py-6">
        <div className="text-xs tracking-[0.2em] text-emerald-200/80">
          ALHADARA
        </div>
        <h1 className="mt-2 text-xl font-bold leading-tight">
          نظام متابعة مهام المشتريات
        </h1>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3">
        {LINKS.filter(
          (link) => !link.roles || (role && link.roles.includes(role))
        ).map((link) => {
          const active =
            link.href === "/dashboard" ||
            link.href === "/my-tasks" ||
            link.href === "/tasks/new" ||
            link.href === "/team" ||
            link.href === "/account"
              ? pathname === link.href || pathname.startsWith(`${link.href}/`)
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-xl px-3 py-2.5 text-sm transition ${
                active
                  ? "bg-white/12 font-semibold text-white"
                  : "text-emerald-50/80 hover:bg-white/8"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-4">
        <div className="text-sm font-semibold">{data?.user?.name}</div>
        <div className="mt-0.5 text-xs text-emerald-100/70">
          {role ? ROLE_LABELS[role] : ""}
        </div>
        <Link
          href="/account"
          className="btn btn-secondary mt-3 w-full text-sm"
        >
          تغيير كلمة المرور
        </Link>
        <button
          type="button"
          className="btn btn-secondary mt-2 w-full text-sm"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          تسجيل الخروج
        </button>
      </div>
    </aside>
  );
}
