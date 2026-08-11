"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/PageHeader";
import { PriorityBadge, StatusBadge } from "@/components/StatusBadge";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useLiveNotifications } from "@/hooks/useLiveNotifications";
import { apiGet } from "@/lib/client";
import { formatDate, formatPercent } from "@/lib/format";

function formatScoreAvg(avg: number | null | undefined) {
  if (avg == null || Number.isNaN(avg)) return "—";
  return (Math.round(avg * 10) / 10).toFixed(1);
}

const ARABIC_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

function formatMonthKey(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return monthKey;
  return `${ARABIC_MONTHS[m - 1]} ${y}`;
}

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

interface TeamPerformanceRow {
  userId: string;
  name: string;
  avgScore: number | null;
  reviewCount: number;
}

interface MonthHistoryRow {
  monthKey: string;
  avgScore: number;
  reviewCount: number;
}

interface PerformanceHistory {
  userId: string;
  name: string;
  role: string;
  months: MonthHistoryRow[];
}

interface DashboardData {
  role: "general_manager" | "ceo" | "manager" | "employee";
  redirectTo?: string;
  kpis: Record<string, number>;
  needsAttention: AttentionTask[];
  performanceMonth?: string;
  teamPerformance?: TeamPerformanceRow[];
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [history, setHistory] = useState<PerformanceHistory | null>(null);
  const role = session?.user?.role;

  const load = useCallback(async () => {
    const res = await apiGet<DashboardData>("/api/dashboard");
    if (res.redirectTo) {
      router.replace(res.redirectTo);
      return;
    }
    setData(res);
    setError("");
  }, [router]);

  useEffect(() => {
    if (authStatus === "loading") return;
    if (role === "employee") {
      router.replace("/my-tasks");
      return;
    }
    if (role === "hr") {
      router.replace("/hr");
      return;
    }
    load().catch((e) => setError(e.message));
  }, [authStatus, role, router, load]);

  useAutoRefresh(() => load().catch(() => undefined), {
    enabled:
      authStatus === "authenticated" &&
      (role === "general_manager" ||
        role === "ceo" ||
        role === "manager"),
    minMs: 45_000,
    maxMs: 75_000,
  });
  useLiveNotifications(
    () => load().catch(() => undefined),
    authStatus === "authenticated" &&
      (role === "general_manager" || role === "ceo" || role === "manager")
  );

  async function openHistory(row: TeamPerformanceRow) {
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryError("");
    setHistory(null);
    try {
      const res = await apiGet<PerformanceHistory>(
        `/api/performance/${row.userId}`
      );
      setHistory(res);
    } catch (err) {
      setHistoryError(
        err instanceof Error ? err.message : "فشل تحميل سجل التقييم"
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  function closeHistory() {
    setHistoryOpen(false);
    setHistory(null);
    setHistoryError("");
  }

  if (authStatus === "loading" || role === "employee" || role === "hr") {
    return <p className="text-[var(--muted)]">جارٍ التحميل...</p>;
  }

  const isLeadership = role === "general_manager" || role === "ceo";
  const isGm = role === "general_manager";

  const kpiItems =
    isLeadership
      ? [
          { key: "total", label: "إجمالي المهام" },
          ...(isGm
            ? [{ key: "ceoTasks", label: "مهام المدير التنفيذي" }]
            : []),
          { key: "managerTasks", label: isGm ? "مهام المدراء" : "مهام المدراء والموارد البشرية" },
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
    if (isLeadership) {
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
          isLeadership
            ? isGm
              ? "نظرة شاملة على مهام التنفيذي والمدراء والموظفين"
              : "نظرة شاملة على مهام المدراء والموظفين"
            : "ملخص مهامك من الإدارة ومتابعة فريقك"
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {isLeadership ? (
              <>
                <Link href="/track" className="btn btn-secondary">
                  {isGm ? "متابعة القيادة" : "مهام المدراء"}
                </Link>
                <Link href="/employee-review" className="btn btn-secondary">
                  مهام الموظفين
                </Link>
                {role === "ceo" ? (
                  <Link href="/ceo-tasks" className="btn btn-secondary">
                    مهامي من المدير العام
                  </Link>
                ) : null}
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

          {(role === "ceo" || role === "manager") &&
          Array.isArray(data.teamPerformance) ? (
            <div className="mb-6">
              <h3 className="mb-1 text-lg font-semibold">
                تقييم الأداء الشهري
              </h3>
              <p className="mb-3 text-sm text-[var(--muted)]">
                متوسط التقييم لهذا الشهر
                {data.performanceMonth ? ` (${data.performanceMonth})` : ""}
                {role === "ceo"
                  ? " — المدراء"
                  : " — موظفو فريقك"}
                . اضغط على البطاقة لعرض متوسطات الأشهر السابقة.
              </p>
              {data.teamPerformance.length === 0 ? (
                <div className="card p-6 text-[var(--muted)]">
                  لا يوجد أعضاء لعرض تقييمهم
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {data.teamPerformance.map((row) => (
                    <button
                      key={row.userId}
                      type="button"
                      onClick={() => openHistory(row)}
                      className="card p-4 text-start transition hover:border-[var(--brand)] hover:shadow-md active:scale-[0.99]"
                    >
                      <div className="font-semibold">{row.name}</div>
                      <div className="mt-2 flex items-end justify-between gap-2">
                        <div>
                          <div className="text-xs text-[var(--muted)]">
                            المتوسط /10
                          </div>
                          <div className="text-3xl font-bold text-[var(--brand)]">
                            {formatScoreAvg(row.avgScore)}
                          </div>
                        </div>
                        <div className="text-sm text-[var(--muted)]">
                          {row.reviewCount > 0
                            ? `${row.reviewCount} تقييم`
                            : "لا تقييمات بعد"}
                        </div>
                      </div>
                      <div className="mt-3 text-xs font-semibold text-[var(--brand)]">
                        عرض سجل الأشهر ←
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {historyOpen ? (
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
              role="dialog"
              aria-modal="true"
              onClick={closeHistory}
            >
              <div
                className="card max-h-[85vh] w-full max-w-lg overflow-auto p-5"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">
                      سجل التقييم — {history?.name || "…"}
                    </h3>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      متوسط كل شهر محفوظ ويبقى بعد بدء دورة جديدة
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={closeHistory}
                  >
                    إغلاق
                  </button>
                </div>

                {historyLoading ? (
                  <p className="text-[var(--muted)]">جارٍ التحميل...</p>
                ) : historyError ? (
                  <p className="text-[var(--danger)]">{historyError}</p>
                ) : !history || history.months.length === 0 ? (
                  <p className="text-[var(--muted)]">
                    لا توجد تقييمات مسجّلة بعد
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {history.months.map((m) => (
                      <li
                        key={m.monthKey}
                        className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] px-3 py-2.5"
                      >
                        <div>
                          <div className="font-medium">
                            {formatMonthKey(m.monthKey)}
                          </div>
                          <div className="text-xs text-[var(--muted)]">
                            {m.reviewCount} تقييم
                          </div>
                        </div>
                        <div className="text-2xl font-bold text-[var(--brand)]">
                          {formatScoreAvg(m.avgScore)}
                          <span className="ms-1 text-sm font-normal text-[var(--muted)]">
                            /10
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}

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
