"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

export default function TrackPage() {
  const { data: session, status: authStatus } = useSession();
  const [tasks, setTasks] = useState<TaskCardData[]>([]);
  const [filters, setFilters] = useState<TaskFilterState>(EMPTY_TASK_FILTERS);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const role = session?.user?.role;
  const canAssign =
    role === "general_manager" || role === "ceo" || role === "manager";
  const isLeadership = role === "general_manager" || role === "ceo";
  const ready =
    authStatus === "authenticated" &&
    (role === "general_manager" || role === "ceo");

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const qs =
          role === "general_manager"
            ? "?leadershipTasks=1"
            : role === "ceo"
              ? "?managerTasks=1"
              : "";
        const data = await apiGet<TaskCardData[]>(`/api/tasks${qs}`);
        setTasks(data);
        setError("");
      } catch (e) {
        if (!silent) setError(e instanceof Error ? e.message : "فشل التحميل");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [role]
  );

  useEffect(() => {
    if (authStatus === "loading") return;
    if (!ready) return;
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

  return (
    <div>
      <PageHeader
        title={
          role === "general_manager"
            ? "متابعة التنفيذي والموارد البشرية والمدراء"
            : "متابعة مهام المدراء والموارد البشرية"
        }
        subtitle={
          role === "general_manager"
            ? "تتبع مهام المدير التنفيذي والموارد البشرية والمدراء"
            : "تتبع ومراجعة المهام المسندة للمدراء والموارد البشرية"
        }
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
        showDepartment={isLeadership}
        searchPlaceholder="رقم المهمة، الاسم، المسؤول، القسم..."
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
