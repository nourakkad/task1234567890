"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/PageHeader";
import { TaskCard, type TaskCardData } from "@/components/tasks/TaskCard";
import { TASK_STATUSES } from "@/constants/lookups";
import { apiGet } from "@/lib/client";

export default function TrackPage() {
  const { data: session, status: authStatus } = useSession();
  const [tasks, setTasks] = useState<TaskCardData[]>([]);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const canAssign =
    session?.user?.role === "ceo" || session?.user?.role === "manager";

  useEffect(() => {
    if (authStatus === "loading") return;

    setLoading(true);
    const qs = new URLSearchParams(
      session?.user?.role === "ceo" ? { managerTasks: "1" } : {}
    );
    if (status) qs.set("status", status);
    const queryStr = qs.toString();
    apiGet<TaskCardData[]>(`/api/tasks${queryStr ? `?${queryStr}` : ""}`)
      .then(setTasks)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [authStatus, status, session?.user?.role]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((t) => {
      const hay = [
        t.taskNo,
        t.name,
        t.description,
        t.ownerId?.name,
        t.departmentId?.name,
        t.nextAction,
        t.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [tasks, query]);

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

      <div className="mb-5 flex flex-wrap gap-3">
        <div className="field min-w-64 flex-1">
          <label>بحث</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="رقم المهمة، الاسم، المدير، القسم..."
          />
        </div>
        <div className="field min-w-52">
          <label>تصفية بالحالة</label>
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
        <p className="text-[var(--muted)]">جارٍ تحميل المهام...</p>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center text-[var(--muted)]">
          لا توجد مهام مطابقة
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
