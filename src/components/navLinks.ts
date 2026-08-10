import type { UserRole } from "@/constants/lookups";

export const NAV_LINKS: Array<{
  href: string;
  label: string;
  roles?: UserRole[];
}> = [
  {
    href: "/dashboard",
    label: "لوحة المتابعة",
    roles: ["general_manager", "ceo", "manager"],
  },
  {
    href: "/track",
    label: "متابعة المدراء والتنفيذي",
    roles: ["general_manager"],
  },
  {
    href: "/track",
    label: "متابعة مهام المدراء",
    roles: ["ceo"],
  },
  {
    href: "/employee-review",
    label: "متابعة مهام الموظفين",
    roles: ["general_manager", "ceo"],
  },
  {
    href: "/ceo-tasks",
    label: "مهام من المدير العام",
    roles: ["ceo"],
  },
  {
    href: "/tasks/new",
    label: "إسناد مهمة",
    roles: ["general_manager", "ceo", "manager"],
  },
  {
    href: "/departments",
    label: "إدارة الأقسام",
    roles: ["ceo"],
  },
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
    roles: ["general_manager", "ceo", "manager", "employee"],
  },
];

export function isNavActive(pathname: string, href: string) {
  if (
    href === "/dashboard" ||
    href === "/my-tasks" ||
    href === "/tasks/new" ||
    href === "/team" ||
    href === "/departments" ||
    href === "/account" ||
    href === "/ceo-tasks"
  ) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  return pathname.startsWith(href);
}
