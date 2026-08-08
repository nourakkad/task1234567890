"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/PageHeader";
import { TaskCard, type TaskCardData } from "@/components/tasks/TaskCard";
import { TaskFilters } from "@/components/tasks/TaskFilters";
import { apiGet } from "@/lib/client";
import {
  EMPTY_TASK_FILTERS,
  filterTasks,
  type TaskFilterState,
} from "@/lib/taskFilters";

interface EmployeeTask extends TaskCardData {
  assignedById?: { name?: string; role?: string } | null;
}

export default function EmployeeReviewPage() {
  const { data: session, status: authStatus } = useSession();
  const [tasks, setTasks] = useState<EmployeeTask[]>([]);
  const [filters, setFilters] = useState<TaskFilterState>(EMPTY_TASK_FILTERS);
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
    setError("");
    apiGet<EmployeeTask[]>("/api/tasks?employeeTasks=1")
      .then(setTasks)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [authStatus, session?.user?.role]);

  const filtered = useMemo(
    () => filterTasks(tasks, filters),
    [tasks, filters]
  );

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

      <TaskFilters
        value={filters}
        onChange={setFilters}
        showDepartment
        searchPlaceholder="رقم المهمة، الموظف، القسم، الرسالة..."
      />

      {error ? <p className="mb-3 text-[var(--danger)]">{error}</p> : null}

      {!loading && !error ? (
        <p className="mb-3 text-sm text-[var(--muted)]">
          عرض {filtered.length} من {tasks.length} مهمة
        </p>
      ) : null}

      {loading ? (
        <p className="text-[var(--muted)]">جارٍ تحميل مهام الموظفين...</p>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center text-[var(--muted)]">
          لا توجد مهام موظفين مطابقة للتصفية
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
