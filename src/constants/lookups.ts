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
  "manager",
  "employee",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  general_manager: "المدير العام",
  ceo: "المدير التنفيذي",
  manager: "مدير",
  employee: "موظف",
};

export const DEPARTMENT_NAMES = [
  "المشتريات",
  "اللوجستيات",
  "الجودة",
  "المالية",
  "العمليات",
] as const;
