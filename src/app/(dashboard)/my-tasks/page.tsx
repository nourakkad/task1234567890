"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/PageHeader";
import { TaskCard, type TaskCardData } from "@/components/tasks/TaskCard";
import { TASK_STATUSES } from "@/constants/lookups";
import { apiGet } from "@/lib/client";

interface MyTask extends TaskCardData {
  nextAction?: string;
  managementDecision?: string;
  assignedById?: { name?: string } | null;
}

export default function MyTasksPage() {
  const { data: session, status: authStatus } = useSession();
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authStatus === "loading") return;
    if (session?.user?.role !== "employee") {
      setError("هذه الصفحة للموظفين فقط");
      setLoading(false);
      return;
    }

    setLoading(true);
    const qs = new URLSearchParams({ fromManager: "1" });
    if (status) qs.set("status", status);

    apiGet<MyTask[]>(`/api/tasks?${qs.toString()}`)
      .then(setTasks)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [authStatus, session?.user?.role, status]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((t) =>
      [t.taskNo, t.name, t.nextAction, t.status, t.assignedById?.name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [tasks, query]);

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

      <div className="mb-5 flex flex-wrap gap-3">
        <div className="field min-w-64 flex-1">
          <label>بحث</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="رقم المهمة، الأمر..."
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
        <p className="text-[var(--muted)]">جارٍ التحميل...</p>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center text-[var(--muted)]">
          لا توجد مهام مسندة إليك حاليًا
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
