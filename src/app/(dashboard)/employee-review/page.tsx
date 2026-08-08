"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/PageHeader";
import { TaskCard, type TaskCardData } from "@/components/tasks/TaskCard";
import { TASK_STATUSES } from "@/constants/lookups";
import { apiGet } from "@/lib/client";

interface EmployeeTask extends TaskCardData {
  assignedById?: { name?: string; role?: string } | null;
}

export default function EmployeeReviewPage() {
  const { data: session, status: authStatus } = useSession();
  const [tasks, setTasks] = useState<EmployeeTask[]>([]);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authStatus === "loading") return;
    if (session?.user?.role !== "ceo") {
      setError("هذه الصفحة للمدير التنفيذي فقط");
      setLoading(false);
      return;
    }

    setLoading(true);
    const qs = new URLSearchParams({ employeeTasks: "1" });
    if (status) qs.set("status", status);

    apiGet<EmployeeTask[]>(`/api/tasks?${qs.toString()}`)
      .then(setTasks)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [authStatus, session?.user?.role, status]);

  const departments = useMemo(() => {
    const names = new Set<string>();
    tasks.forEach((t) => {
      if (t.departmentId?.name) names.add(t.departmentId.name);
    });
    return Array.from(names).sort();
  }, [tasks]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (department && t.departmentId?.name !== department) return false;
      if (!q) return true;
      const hay = [
        t.taskNo,
        t.name,
        t.ownerId?.name,
        t.departmentId?.name,
        t.assignedById?.name,
        t.nextAction,
        t.lastMessage?.text,
        t.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [tasks, query, department]);

  if (authStatus === "loading") {
    return <p className="text-[var(--muted)]">جارٍ التحميل...</p>;
  }

  if (session?.user?.role !== "ceo") {
    return (
      <div className="card p-6 text-[var(--danger)]">
        هذه الصفحة للمدير التنفيذي فقط
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="متابعة مهام الموظفين"
        subtitle="عرض ومراجعة جميع مهام الموظفين عبر الأقسام"
      />

      <div className="mb-5 flex flex-wrap gap-3">
        <div className="field min-w-64 flex-1">
          <label>بحث</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="رقم المهمة، الموظف، القسم، الرسالة..."
          />
        </div>
        <div className="field min-w-44">
          <label>القسم</label>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            <option value="">كل الأقسام</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="field min-w-44">
          <label>الحالة</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">الكل</option>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? <p className="mb-3 text-[var(--danger)]">{error}</p> : null}

      {loading ? (
        <p className="text-[var(--muted)]">جارٍ تحميل مهام الموظفين...</p>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center text-[var(--muted)]">
          لا توجد مهام موظفين مطابقة
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((task) => (
            <TaskCard
              key={task._id}
              task={task}
              href={`/employee-review/${task._id}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
