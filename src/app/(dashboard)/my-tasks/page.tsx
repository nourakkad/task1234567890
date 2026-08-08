"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/PageHeader";
import { TaskCard, type TaskCardData } from "@/components/tasks/TaskCard";
import { TaskFilters } from "@/components/tasks/TaskFilters";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { apiGet } from "@/lib/client";
import {
  EMPTY_TASK_FILTERS,
  filterTasks,
  type TaskFilterState,
} from "@/lib/taskFilters";

interface MyTask extends TaskCardData {
  nextAction?: string;
  managementDecision?: string;
  assignedById?: { name?: string } | null;
}

export default function MyTasksPage() {
  const { data: session, status: authStatus } = useSession();
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [filters, setFilters] = useState<TaskFilterState>(EMPTY_TASK_FILTERS);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const ready =
    authStatus === "authenticated" && session?.user?.role === "employee";

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await apiGet<MyTask[]>("/api/tasks?fromManager=1");
      setTasks(data);
      setError("");
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : "فشل التحميل");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === "loading") return;
    if (!ready) {
      setError("هذه الصفحة للموظفين فقط");
      setLoading(false);
      return;
    }
    load(false);
  }, [authStatus, ready, load]);

  useAutoRefresh(() => load(true), { enabled: ready });

  const filtered = useMemo(
    () => filterTasks(tasks, filters),
    [tasks, filters]
  );

  if (authStatus === "loading") {
    return <p className="text-[var(--muted)]">جارٍ التحميل...</p>;
  }

  if (session?.user?.role !== "employee") {
    return (
      <div className="card p-6 text-[var(--danger)]">
        هذه الصفحة للموظفين فقط.
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="مهامي"
        subtitle="المهام المسندة إليك من المدير — نفّذ الأمر وأضف التحديثات"
      />

      <TaskFilters
        value={filters}
        onChange={setFilters}
        searchPlaceholder="رقم المهمة، الأمر..."
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
            <TaskCard key={task._id} task={task} href={`/my-tasks/${task._id}`} />
          ))}
        </div>
      )}
    </div>
  );
}
