"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/PageHeader";
import { PriorityBadge, StatusBadge } from "@/components/StatusBadge";
import { apiGet } from "@/lib/client";
import { formatDate, formatPercent } from "@/lib/format";

interface AttentionTask {
  _id: string;
  taskNo: string;
  name: string;
  status: string;
  priority: string;
  lastUpdate?: string;
  nextAction?: string;
  ownerId?: { name?: string; role?: string };
  departmentId?: { name?: string };
}

interface DashboardData {
  role: "ceo" | "manager" | "employee";
  redirectTo?: string;
  kpis: Record<string, number>;
  needsAttention: AttentionTask[];
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const role = session?.user?.role;

  useEffect(() => {
    if (authStatus === "loading") return;
    if (role === "employee") {
      router.replace("/my-tasks");
      return;
    }

    apiGet<DashboardData>("/api/dashboard")
      .then((res) => {
        if (res.redirectTo) {
          router.replace(res.redirectTo);
          return;
        }
        setData(res);
      })
      .catch((e) => setError(e.message));
  }, [authStatus, role, router]);

  if (authStatus === "loading" || role === "employee") {
    return <p className="text-[var(--muted)]">جارٍ التحميل...</p>;
  }

  const isCeo = role === "ceo";

  const kpiItems =
    isCeo
      ? [
          { key: "total", label: "إجمالي المهام" },
          { key: "managerTasks", label: "مهام المدراء" },
          { key: "employeeTasks", label: "مهام الموظفين" },
          { key: "waitingManagement", label: "بانتظار قرار الإدارة" },
          { key: "inProgress", label: "قيد التنفيذ" },
          { key: "overdue", label: "متأخرة" },
          { key: "completed", label: "مكتملة" },
          { key: "avgProgress", label: "متوسط الإنجاز", format: "percent" as const },
        ]
      : [
          { key: "total", label: "مهام ضمن نطاقي" },
          { key: "fromCeo", label: "مهام من الإدارة" },
          { key: "teamAssigned", label: "مهام الفريق" },
          { key: "waitingMyDecision", label: "بانتظار قراري" },
          { key: "inProgress", label: "قيد التنفيذ" },
          { key: "overdue", label: "متأخرة" },
          { key: "completed", label: "مكتملة" },
          { key: "avgProgress", label: "متوسط الإنجاز", format: "percent" as const },
        ];

  function taskHref(task: AttentionTask) {
    if (isCeo) {
      return task.ownerId?.role === "employee"
        ? `/employee-review/${task._id}`
        : `/track/${task._id}`;
    }
    // manager
    if (task.ownerId?.role === "employee") {
      return `/team-tasks/${task._id}`;
    }
    return `/manager-tasks/${task._id}`;
  }

  return (
    <div>
      <PageHeader
        title="لوحة المتابعة"
        subtitle={
          isCeo
            ? "نظرة شاملة على مهام المدراء والموظفين"
            : "ملخص مهامك من الإدارة ومتابعة فريقك"
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {isCeo ? (
              <>
                <Link href="/track" className="btn btn-secondary">
                  مهام المدراء
                </Link>
                <Link href="/employee-review" className="btn btn-secondary">
                  مهام الموظفين
                </Link>
                <Link href="/tasks/new" className="btn btn-primary">
                  إسناد مهمة
                </Link>
              </>
            ) : (
              <>
                <Link href="/manager-tasks" className="btn btn-secondary">
                  مهام من الإدارة
                </Link>
                <Link href="/team-tasks" className="btn btn-secondary">
                  متابعة الفريق
                </Link>
                <Link href="/tasks/new" className="btn btn-primary">
                  تكليف موظف
                </Link>
              </>
            )}
          </div>
        }
      />

      {error ? (
        <p className="text-[var(--danger)]">{error}</p>
      ) : !data ? (
        <p className="text-[var(--muted)]">جارٍ التحميل...</p>
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {kpiItems.map((item) => (
              <div key={item.key} className="card p-4">
                <div className="text-sm text-[var(--muted)]">{item.label}</div>
                <div className="mt-2 text-3xl font-bold text-[var(--brand)]">
                  {item.format === "percent"
                    ? formatPercent(data.kpis[item.key])
                    : data.kpis[item.key] ?? 0}
                </div>
              </div>
            ))}
          </div>

          <div>
            <h3 className="mb-3 text-lg font-semibold">
              المهام التي تحتاج متابعة
            </h3>
            {data.needsAttention.length === 0 ? (
              <div className="card p-6 text-[var(--muted)]">
                لا توجد مهام تحتاج متابعة حاليًا
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {data.needsAttention.map((task) => (
                  <Link
                    key={task._id}
                    href={taskHref(task)}
                    className="card block p-4 transition hover:border-[var(--brand)] hover:shadow-md active:scale-[0.99]"
                  >
                    <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-semibold text-[var(--brand)]">
                          {task.taskNo}
                        </div>
                        <h4 className="mt-1 font-bold leading-snug">
                          {task.name}
                        </h4>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <StatusBadge status={task.status} />
                        <PriorityBadge priority={task.priority} />
                      </div>
                    </div>
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <dt className="text-xs text-[var(--muted)]">المسؤول</dt>
                        <dd className="font-medium">
                          {task.ownerId?.name || "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-[var(--muted)]">القسم</dt>
                        <dd className="font-medium">
                          {task.departmentId?.name || "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-[var(--muted)]">آخر تحديث</dt>
                        <dd>{formatDate(task.lastUpdate)}</dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-xs text-[var(--muted)]">
                          الإجراء التالي
                        </dt>
                        <dd className="mt-0.5">{task.nextAction || "—"}</dd>
                      </div>
                    </dl>
                    <div className="mt-3 text-xs font-semibold text-[var(--brand)]">
                      اضغط لفتح بطاقة المهمة ←
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
