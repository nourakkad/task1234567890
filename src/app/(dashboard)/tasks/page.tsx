"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/PageHeader";
import { TaskCard, type TaskCardData } from "@/components/tasks/TaskCard";
import { TASK_STATUSES } from "@/constants/lookups";
import { apiGet } from "@/lib/client";

export default function TasksPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskCardData[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const role = session?.user?.role;
  const canCreate = role === "ceo" || role === "manager";

  useEffect(() => {
    if (authStatus === "loading") return;
    if (role === "ceo") {
      router.replace("/track");
      return;
    }

    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    apiGet<TaskCardData[]>(`/api/tasks${qs}`)
      .then(setTasks)
      .catch((e) => setError(e.message));
  }, [authStatus, role, status, router]);

  if (authStatus === "loading" || role === "ceo") {
    return <p className="text-[var(--muted)]">جارٍ التحميل...</p>;
  }

  return (
    <div>
      <PageHeader
        title="سجل المهام"
        subtitle="متابعة المهام ضمن نطاق صلاحيتك — كل مهمة على بطاقة"
        actions={
          canCreate ? (
            <Link href="/tasks/new" className="btn btn-primary">
              مهمة جديدة
            </Link>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
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

      {tasks.length === 0 ? (
        <div className="card p-8 text-center text-[var(--muted)]">
          لا توجد مهام
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tasks.map((task) => (
            <TaskCard key={task._id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}
