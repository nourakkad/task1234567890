"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/PageHeader";
import { TaskCard, type TaskCardData } from "@/components/tasks/TaskCard";
import { TaskFilters } from "@/components/tasks/TaskFilters";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useLiveNotifications } from "@/hooks/useLiveNotifications";
import { apiGet } from "@/lib/client";
import { rememberTasks } from "@/lib/offlineCatalog";
import {
  EMPTY_TASK_FILTERS,
  filterTasks,
  type TaskFilterState,
} from "@/lib/taskFilters";
import { ROLE_LABELS } from "@/constants/lookups";

/** HR inbox: tasks assigned by GM or CEO */
export default function HrTasksPage() {
  const { data: session, status: authStatus } = useSession();
  const [tasks, setTasks] = useState<TaskCardData[]>([]);
  const [filters, setFilters] = useState<TaskFilterState>(EMPTY_TASK_FILTERS);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const ready = authStatus === "authenticated" && session?.user?.role === "hr";

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await apiGet<TaskCardData[]>(
        "/api/tasks?fromLeadership=1"
      );
      setTasks(data);
      void rememberTasks(data);
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
      setError("هذه الصفحة للموارد البشرية فقط");
      setLoading(false);
      return;
    }
    load(false);
  }, [authStatus, ready, load]);

  useAutoRefresh(() => load(true), {
    enabled: ready,
    minMs: 45_000,
    maxMs: 75_000,
  });
  useLiveNotifications(() => load(true), ready);

  const filtered = useMemo(
    () => filterTasks(tasks, filters),
    [tasks, filters]
  );

  if (authStatus === "loading") {
    return <p className="text-[var(--muted)]">جارٍ التحميل...</p>;
  }

  if (session?.user?.role !== "hr") {
    return (
      <div className="card p-6 text-[var(--danger)]">
        هذه الصفحة للموارد البشرية فقط
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="مهامي من الإدارة"
        subtitle={`المهام المسندة إليك من ${ROLE_LABELS.general_manager} أو ${ROLE_LABELS.ceo}`}
      />

      <TaskFilters
        value={filters}
        onChange={setFilters}
        searchPlaceholder="رقم المهمة، الاسم..."
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
          لا توجد مهام من الإدارة حاليًا
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((task) => (
            <TaskCard
              key={task._id}
              task={task}
              href={`/hr/tasks/${task._id}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
