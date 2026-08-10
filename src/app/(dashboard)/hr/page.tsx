"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/PageHeader";
import { apiGet } from "@/lib/client";

function formatScoreAvg(avg: number | null | undefined) {
  if (avg == null || Number.isNaN(avg)) return "—";
  return (Math.round(avg * 10) / 10).toFixed(1);
}

interface PerfRow {
  userId: string;
  name: string;
  avgScore: number | null;
  reviewCount: number;
}

interface HrDashboard {
  performanceMonth?: string;
  kpis: {
    managersCount: number;
    employeesCount: number;
    departmentsCount: number;
  };
  managersPerformance: PerfRow[];
  employeesPerformance: PerfRow[];
}

export default function HrDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<HrDashboard | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setData(await apiGet<HrDashboard>("/api/hr/dashboard"));
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    if (session?.user?.role !== "hr") {
      router.replace("/dashboard");
      return;
    }
    load().catch((e) => setError(e.message));
  }, [status, session?.user?.role, router, load]);

  if (status === "loading" || session?.user?.role !== "hr") {
    return <p className="text-[var(--muted)]">جارٍ التحميل...</p>;
  }

  return (
    <div>
      <PageHeader
        title="لوحة الموارد البشرية"
        subtitle="إدارة المدراء والموظفين والأقسام — ومتابعة تقييم الأداء الشهري ومهام الإدارة"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/hr/tasks" className="btn btn-primary">
              مهامي من الإدارة
            </Link>
            <Link href="/hr/managers" className="btn btn-secondary">
              المدراء
            </Link>
            <Link href="/hr/employees" className="btn btn-secondary">
              الموظفون
            </Link>
            <Link href="/hr/departments" className="btn btn-secondary">
              الأقسام
            </Link>
          </div>
        }
      />

      {error ? <p className="text-[var(--danger)]">{error}</p> : null}
      {!data ? (
        <p className="text-[var(--muted)]">جارٍ التحميل...</p>
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <Kpi label="المدراء" value={data.kpis.managersCount} />
            <Kpi label="الموظفون" value={data.kpis.employeesCount} />
            <Kpi label="الأقسام" value={data.kpis.departmentsCount} />
          </div>

          <PerfSection
            title="تقييم المدراء"
            month={data.performanceMonth}
            rows={data.managersPerformance}
          />
          <PerfSection
            title="تقييم الموظفين"
            month={data.performanceMonth}
            rows={data.employeesPerformance}
          />
        </>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <div className="text-sm text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-3xl font-bold text-[var(--brand)]">{value}</div>
    </div>
  );
}

function PerfSection({
  title,
  month,
  rows,
}: {
  title: string;
  month?: string;
  rows: PerfRow[];
}) {
  return (
    <div className="mb-6">
      <h3 className="mb-1 text-lg font-semibold">{title}</h3>
      <p className="mb-3 text-sm text-[var(--muted)]">
        متوسط الشهر الحالي{month ? ` (${month})` : ""}
      </p>
      {rows.length === 0 ? (
        <div className="card p-5 text-[var(--muted)]">لا يوجد بيانات</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <div key={row.userId} className="card p-4">
              <div className="font-semibold">{row.name}</div>
              <div className="mt-2 flex items-end justify-between gap-2">
                <div>
                  <div className="text-xs text-[var(--muted)]">المتوسط /10</div>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
