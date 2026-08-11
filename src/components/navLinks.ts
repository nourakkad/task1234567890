import type { UserRole } from "@/constants/lookups";
import { ROLE_LABELS } from "@/constants/lookups";

/**
 * Sidebar order (filtered per role):
 * 1) Home / dashboard
 * 2) Inbox (tasks assigned to me)
 * 3) Assign / create
 * 4) Track others
 * 5) People / directory
 * 6) Account
 */
export const NAV_LINKS: Array<{
  href: string;
  label: string;
  roles?: UserRole[];
}> = [
  // —— Home ——
  {
    href: "/dashboard",
    label: "لوحة المتابعة",
    roles: ["general_manager", "ceo", "manager"],
  },
  {
    href: "/hr",
    label: "لوحة الموارد البشرية",
    roles: ["hr"],
  },

  // —— Inbox (tasks assigned to me) ——
  {
    href: "/ceo-tasks",
    label: `مهام من ${ROLE_LABELS.general_manager}`,
    roles: ["ceo"],
  },
  {
    href: "/manager-tasks",
    label: "مهام من الإدارة",
    roles: ["manager"],
  },
  {
    href: "/hr/tasks",
    label: "مهامي من الإدارة",
    roles: ["hr"],
  },
  {
    href: "/my-tasks",
    label: "مهامي",
    roles: ["employee"],
  },

  // —— Assign ——
  {
    href: "/tasks/new",
    label: "إسناد مهمة",
    roles: ["general_manager", "ceo", "manager"],
  },

  // —— Track others ——
  {
    href: "/track",
    label: "متابعة القيادات",
    roles: ["general_manager"],
  },
  {
    href: "/track",
    label: "متابعة المدراء والموارد البشرية",
    roles: ["ceo"],
  },
  {
    href: "/employee-review",
    label: "متابعة مهام الموظفين",
    roles: ["general_manager", "ceo"],
  },
  {
    href: "/team-tasks",
    label: "متابعة الفريق",
    roles: ["manager"],
  },

  // —— People / directory ——
  {
    href: "/team",
    label: "عرض الفريق",
    roles: ["ceo", "manager"],
  },
  {
    href: "/hr/managers",
    label: "المدراء",
    roles: ["hr"],
  },
  {
    href: "/hr/employees",
    label: "الموظفون",
    roles: ["hr"],
  },
  {
    href: "/hr/departments",
    label: "الأقسام",
    roles: ["hr"],
  },

  // —— Account (always last) ——
  {
    href: "/account",
    label: "حسابي",
    roles: ["general_manager", "ceo", "hr", "manager", "employee"],
  },
];

export function isNavActive(pathname: string, href: string) {
  if (
    href === "/dashboard" ||
    href === "/hr" ||
    href === "/hr/tasks" ||
    href === "/my-tasks" ||
    href === "/tasks/new" ||
    href === "/team" ||
    href === "/account" ||
    href === "/ceo-tasks"
  ) {
    return (
      pathname === href ||
      (href !== "/hr" && pathname.startsWith(`${href}/`))
    );
  }
  if (href.startsWith("/hr/")) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  return pathname.startsWith(href);
}
