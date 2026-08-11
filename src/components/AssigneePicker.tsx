"use client";

import {
  ROLE_LABELS,
  type ContractType,
  type UserRole,
} from "@/constants/lookups";

export interface AssigneeOption {
  _id: string;
  name: string;
  role: string;
  contractType?: ContractType | string;
  underCeo?: boolean;
  departmentId?: {
    _id?: string;
    name?: string;
    underCeo?: boolean;
  } | string | null;
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
        const isCeoDirect =
          u.role === "employee" &&
          (u.contractType === "external" ||
            u.underCeo ||
            (typeof u.departmentId === "object" &&
              Boolean(u.departmentId?.underCeo)));
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
                isCeoDirect
                  ? "font-semibold text-[var(--brand)]"
                  : "text-[var(--muted)]"
              }`}
            >
              {isCeoDirect
                ? `${ROLE_LABELS.employee} · تحت ${ROLE_LABELS.ceo}${
                    deptName ? ` · ${deptName}` : ""
                  }`
                : [roleLabel, deptName].filter(Boolean).join(" · ")}
            </div>
          </button>
        );
      })}
    </div>
  );
}
