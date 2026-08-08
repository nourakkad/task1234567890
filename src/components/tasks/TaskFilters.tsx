"use client";

import { TASK_PRIORITIES, TASK_STATUSES } from "@/constants/lookups";
import type { TaskFilterState } from "@/lib/taskFilters";

interface DeptOption {
  id: string;
  name: string;
}

interface TaskFiltersProps {
  value: TaskFilterState;
  onChange: (next: TaskFilterState) => void;
  departments?: DeptOption[];
  searchPlaceholder?: string;
  showPriority?: boolean;
  showDepartment?: boolean;
}

export function TaskFilters({
  value,
  onChange,
  departments = [],
  searchPlaceholder = "رقم المهمة، الاسم، المسؤول...",
  showPriority = true,
  showDepartment = false,
}: TaskFiltersProps) {
  function patch(partial: Partial<TaskFilterState>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="mb-5 flex flex-wrap gap-3">
      <div className="field min-w-64 flex-1">
        <label htmlFor="task-filter-q">بحث</label>
        <input
          id="task-filter-q"
          value={value.query}
          onChange={(e) => patch({ query: e.target.value })}
          placeholder={searchPlaceholder}
        />
      </div>

      {showDepartment ? (
        <div className="field min-w-44">
          <label htmlFor="task-filter-dept">القسم</label>
          <select
            id="task-filter-dept"
            value={value.departmentId}
            onChange={(e) => patch({ departmentId: e.target.value })}
          >
            <option value="">كل الأقسام</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="field min-w-44">
        <label htmlFor="task-filter-status">الحالة</label>
        <select
          id="task-filter-status"
          value={value.status}
          onChange={(e) => patch({ status: e.target.value })}
        >
          <option value="">الكل</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {showPriority ? (
        <div className="field min-w-40">
          <label htmlFor="task-filter-priority">الأولوية</label>
          <select
            id="task-filter-priority"
            value={value.priority}
            onChange={(e) => patch({ priority: e.target.value })}
          >
            <option value="">الكل</option>
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {value.query ||
      value.status ||
      value.priority ||
      value.departmentId ? (
        <div className="flex items-end">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              onChange({
                query: "",
                status: "",
                priority: "",
                departmentId: "",
              })
            }
          >
            مسح التصفية
          </button>
        </div>
      ) : null}
    </div>
  );
}
