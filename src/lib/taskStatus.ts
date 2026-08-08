import { TASK_STATUSES, type TaskStatus, type UserRole } from "@/constants/lookups";

const EMPLOYEE_ALLOWED: readonly TaskStatus[] = [
  "لم تبدأ",
  "قيد التنفيذ",
  "بانتظار المورد",
  "بانتظار قرار الإدارة",
  "معلقة",
];

export function isTaskStatus(value: unknown): value is TaskStatus {
  return (
    typeof value === "string" &&
    (TASK_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Validate a status change for the acting role.
 * Returns Arabic error message or null if allowed.
 */
export function validateStatusChange(
  role: UserRole,
  nextStatus: unknown,
  _currentManagerApproval?: string
): string | null {
  if (nextStatus === undefined || nextStatus === null || nextStatus === "") {
    return null;
  }

  if (!isTaskStatus(nextStatus)) {
    return "حالة المهمة غير صالحة";
  }

  if (role === "employee" && !EMPLOYEE_ALLOWED.includes(nextStatus)) {
    return "الموظف لا يمكنه إغلاق أو إلغاء المهمة مباشرة";
  }

  return null;
}

export function clampProgress(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, Math.round(n)));
}
