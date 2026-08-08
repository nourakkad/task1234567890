"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

export default function TrackPage() {
  const { data: session, status: authStatus } = useSession();
  const [tasks, setTasks] = useState<TaskCardData[]>([]);
  const [filters, setFilters] = useState<TaskFilterState>(EMPTY_TASK_FILTERS);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const canAssign =
    session?.user?.role === "ceo" || session?.user?.role === "manager";

  useEffect(() => {
    if (authStatus === "loading") return;

    setLoading(true);
    setError("");
    const qs =
      session?.user?.role === "ceo" ? "?managerTasks=1" : "";
    apiGet<TaskCardData[]>(`/api/tasks${qs}`)
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

  return (
    <div>
      <PageHeader
        title="متابعة مهام المدراء"
        subtitle="تتبع ومراجعة المهام المسندة للمدراء"
        actions={
          canAssign ? (
            <Link href="/tasks/new" className="btn btn-primary">
              إسناد مهمة
            </Link>
          ) : null
        }
      />

      <TaskFilters
        value={filters}
        onChange={setFilters}
        showDepartment={session?.user?.role === "ceo"}
        searchPlaceholder="رقم المهمة، الاسم، المدير، القسم..."
      />

      {error ? <p className="mb-3 text-[var(--danger)]">{error}</p> : null}

      {!loading && !error ? (
        <p className="mb-3 text-sm text-[var(--muted)]">
          عرض {filtered.length} من {tasks.length} مهمة
        </p>
      ) : null}

      {loading ? (
        <p className="text-[var(--muted)]">جارٍ تحميل المهام...</p>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center text-[var(--muted)]">
          لا توجد مهام مطابقة للتصفية
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((task) => (
            <TaskCard key={task._id} task={task} href={`/track/${task._id}`} />
          ))}
        </div>
      )}
    </div>
  );
}
