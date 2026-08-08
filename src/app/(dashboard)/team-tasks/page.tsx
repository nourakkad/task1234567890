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

interface TeamTask extends TaskCardData {
  nextAction?: string;
  managementDecision?: string;
}

export default function TeamTasksPage() {
  const { data: session, status: authStatus } = useSession();
  const [tasks, setTasks] = useState<TeamTask[]>([]);
  const [filters, setFilters] = useState<TaskFilterState>(EMPTY_TASK_FILTERS);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authStatus === "loading") return;
    if (session?.user?.role !== "manager") {
      setError("هذه الصفحة للمدراء فقط");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    apiGet<TeamTask[]>("/api/tasks?teamAssigned=1")
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

  if (session?.user?.role !== "manager") {
    return (
      <div className="card p-6 text-[var(--danger)]">
        هذه الصفحة للمدراء فقط
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="متابعة الفريق"
        subtitle="المهام التي أسندتها لموظفيك — راقب التحديثات وأصدر القرار/الأمر"
        actions={
          <Link href="/tasks/new" className="btn btn-primary">
            تكليف موظف
          </Link>
        }
      />

      <TaskFilters
        value={filters}
        onChange={setFilters}
        searchPlaceholder="رقم المهمة، الموظف، الأمر..."
      />

      {error ? <p className="mb-3 text-[var(--danger)]">{error}</p> : null}

      {!loading && !error ? (
        <p className="mb-3 text-sm text-[var(--muted)]">
          عرض {filtered.length} من {tasks.length} مهمة
        </p>
      ) : null}

      {loading ? (
        <p className="text-[var(--muted)]">جارٍ التحميل...</p>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center text-[var(--muted)]">
          لا توجد مهام مطابقة للتصفية
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((task) => (
            <TaskCard
              key={task._id}
              task={task}
              href={`/team-tasks/${task._id}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
