export const TASK_STATUSES = [
  "لم تبدأ",
  "قيد التنفيذ",
  "بانتظار المورد",
  "بانتظار قرار الإدارة",
  "معلقة",
  "مكتملة",
  "ملغاة",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = [
  "منخفضة",
  "متوسطة",
  "عالية",
  "عاجلة",
] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const SAMPLE_STATUSES = [
  "لم تطلب",
  "تم الطلب",
  "قيد التحضير",
  "تم الشحن",
  "تم الاستلام",
  "تم الفحص",
] as const;

export type SampleStatus = (typeof SAMPLE_STATUSES)[number];

export const DOCUMENT_TYPES = [
  "تكليف المهمة",
  "ملف المورد",
  "ورقة مواصفات فنية",
  "عرض سعر",
  "شهادة",
  "سجل تواصل",
  "صورة عينة",
  "تقرير فحص",
  "عقد",
  "تقرير نهائي",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const SUPPLIER_DECISIONS = [
  "قيد التقييم",
  "مقبول",
  "مستبعد",
  "معلق",
] as const;

export type SupplierDecision = (typeof SUPPLIER_DECISIONS)[number];

export const MANAGER_APPROVALS = [
  "pending",
  "approved",
  "rejected",
] as const;

export type ManagerApproval = (typeof MANAGER_APPROVALS)[number];

export const USER_ROLES = [
  "general_manager",
  "ceo",
  "hr",
  "manager",
  "employee",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  general_manager: "أ.نبيل عرمان . gm",
  ceo: "أ.عامر العمري . ceo",
  hr: "الموارد البشرية",
  manager: "مدير",
  employee: "موظف",
};

export const CONTRACT_TYPES = ["internal", "external"] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  internal: "عقد داخلي",
  external: "عقد خارجي",
};

/** System department for external-contract employees under the CEO. */
export const CEO_DEPARTMENT_NAME = "المدير التنفيذي";

/** Client/server-safe check for CEO-controlled departments. */
export function isCeoControlledDept(d?: {
  underCeo?: boolean;
  name?: string | null;
} | null): boolean {
  if (!d) return false;
  return Boolean(d.underCeo) || d.name === CEO_DEPARTMENT_NAME;
}

export const DEPARTMENT_NAMES = [
  "المشتريات",
  "اللوجستيات",
  "الجودة",
  "المالية",
  "العمليات",
] as const;
