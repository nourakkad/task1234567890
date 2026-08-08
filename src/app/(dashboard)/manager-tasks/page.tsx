"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

interface ManagerTask extends TaskCardData {
  assignedById?: { name?: string; role?: string } | null;
  managementDecision?: string;
}

export default function ManagerTasksPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [tasks, setTasks] = useState<ManagerTask[]>([]);
  const [filters, setFilters] = useState<TaskFilterState>(EMPTY_TASK_FILTERS);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const ready =
    authStatus === "authenticated" && session?.user?.role === "manager";

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await apiGet<ManagerTask[]>("/api/tasks?fromCeo=1");
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
    if (!session) {
      router.replace("/login");
      return;
    }
    if (!ready) {
      setError("هذه الصفحة للمدراء فقط. سجّل الدخول بحساب مدير.");
      setLoading(false);
      return;
    }
    load(false);
  }, [authStatus, session, ready, router, load]);

  useAutoRefresh(() => load(true), { enabled: ready });

  const filtered = useMemo(
    () => filterTasks(tasks, filters),
    [tasks, filters]
  );

  if (authStatus === "loading") {
    return <p className="text-[var(--muted)]">جارٍ التحميل...</p>;
  }

  if (session?.user?.role !== "manager") {
    return (
      <div className="card p-6">
        <p className="text-[var(--danger)]">
          هذه الصفحة للمدراء فقط. سجّل الخروج ثم ادخل بحساب مدير.
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="مهام من الإدارة"
        subtitle="المهام المسندة إليك من المدير التنفيذي"
      />

      <TaskFilters
        value={filters}
        onChange={setFilters}
        searchPlaceholder="رقم المهمة، الاسم، القرار..."
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
            <TaskCard
              key={task._id}
              task={task}
              href={`/manager-tasks/${task._id}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
