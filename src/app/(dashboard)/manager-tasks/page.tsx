"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/PageHeader";
import { TaskCard, type TaskCardData } from "@/components/tasks/TaskCard";
import { TASK_STATUSES } from "@/constants/lookups";
import { apiGet } from "@/lib/client";

interface ManagerTask extends TaskCardData {
  assignedById?: { name?: string; role?: string } | null;
  managementDecision?: string;
}

export default function ManagerTasksPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [tasks, setTasks] = useState<ManagerTask[]>([]);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authStatus === "loading") return;

    if (!session) {
      router.replace("/login");
      return;
    }

    if (session.user?.role !== "manager") {
      setError("هذه الصفحة للمدراء فقط. سجّل الدخول بحساب مدير.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    const qs = new URLSearchParams({ fromCeo: "1" });
    if (status) qs.set("status", status);

    apiGet<ManagerTask[]>(`/api/tasks?${qs.toString()}`)
      .then(setTasks)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [authStatus, session, status, router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((t) => {
      const hay = [
        t.taskNo,
        t.name,
        t.description,
        t.nextAction,
        t.managementDecision,
        t.status,
        t.assignedById?.name,
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
        subtitle={`المهام لقسم ${session.user.name || "المدير"} — حدّث الصفحة بعد تسجيل الدخول`}
      />

      <div className="mb-5 flex flex-wrap gap-3">
        <div className="field min-w-64 flex-1">
          <label>بحث</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="رقم المهمة، الاسم، القرار..."
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
          لا توجد مهام مُسندة من المدير التنفيذي حاليًا
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
