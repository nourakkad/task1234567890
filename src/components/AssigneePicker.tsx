"use client";

import {
  CONTRACT_TYPE_LABELS,
  ROLE_LABELS,
  type ContractType,
  type UserRole,
} from "@/constants/lookups";

export interface AssigneeOption {
  _id: string;
  name: string;
  role: string;
  contractType?: ContractType | string;
  departmentId?: { _id?: string; name?: string } | string | null;
}

type Props = {
  users: AssigneeOption[];
  value: string;
  onChange: (userId: string) => void;
  loading?: boolean;
  emptyLabel?: string;
};

/**
 * Touch-friendly assignee list. Native <select> on iOS Safari (esp. RTL)
 * often shows a blank wheel even when options exist.
 */
export function AssigneePicker({
  users,
  value,
  onChange,
  loading,
  emptyLabel = "لا يوجد أشخاص متاحون للإسناد",
}: Props) {
  if (loading) {
    return <p className="text-sm text-[var(--muted)]">جارٍ تحميل القائمة...</p>;
  }

  if (users.length === 0) {
    return <p className="text-sm text-[var(--muted)]">{emptyLabel}</p>;
  }

  return (
    <div
      className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-[var(--line)] p-2"
      role="listbox"
      aria-label="اختر المسؤول"
    >
      {users.map((u) => {
        const selected = value === u._id;
        const isExternal =
          u.role === "employee" && u.contractType === "external";
        const roleLabel = ROLE_LABELS[u.role as UserRole] || u.role;
        const deptName =
          typeof u.departmentId === "object" && u.departmentId?.name
            ? u.departmentId.name
            : "";

        return (
          <button
            key={u._id}
            type="button"
            role="option"
            aria-selected={selected}
            onClick={() => onChange(u._id)}
            className={`w-full rounded-xl border px-3 py-3 text-start transition ${
              selected
                ? "border-[var(--brand)] bg-[var(--brand-soft)]"
                : "border-[var(--line)] bg-white hover:border-[var(--neutral)]"
            }`}
          >
            <div className="font-semibold">{u.name}</div>
            <div
              className={`mt-0.5 text-xs ${
                isExternal
                  ? "font-semibold text-[var(--brand)]"
                  : "text-[var(--muted)]"
              }`}
            >
              {isExternal
                ? `${ROLE_LABELS.employee} · ${CONTRACT_TYPE_LABELS.external}`
                : [roleLabel, deptName].filter(Boolean).join(" · ")}
            </div>
          </button>
        );
      })}
    </div>
  );
}
