"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/PageHeader";
import { matchesSearch, SearchField } from "@/components/SearchField";
import { ROLE_LABELS, CEO_DEPARTMENT_NAME } from "@/constants/lookups";
import { apiGet, apiSend } from "@/lib/client";

interface Department {
  _id: string;
  name: string;
  underCeo?: boolean;
  managerId?: { _id?: string; name?: string; email?: string } | null;
}

export default function HrDepartmentsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [name, setName] = useState("");
  const [underCeo, setUnderCeo] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () =>
      departments.filter((d) =>
        matchesSearch(
          query,
          d.name,
          d.managerId?.name,
          d.managerId?.email,
          d.underCeo ? ROLE_LABELS.ceo : ""
        )
      ),
    [departments, query]
  );

  async function load() {
    setDepartments(await apiGet<Department[]>("/api/departments"));
  }

  useEffect(() => {
    if (authStatus === "loading") return;
    if (session?.user?.role !== "hr") {
      router.replace("/dashboard");
      return;
    }
    load().catch((e) => setError(e.message));
  }, [authStatus, session?.user?.role, router]);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("أدخل اسم القسم");
      return;
    }
    setLoading(true);
    try {
      await apiSend("/api/departments", "POST", {
        name: trimmed,
        underCeo,
      });
      setName("");
      setUnderCeo(false);
      await load();
      setMessage("تم إضافة القسم");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الإضافة");
    } finally {
      setLoading(false);
    }
  }

  async function onRename(id: string, nextName: string, prev: string) {
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === prev) return;
    setError("");
    setMessage("");
    try {
      await apiSend("/api/departments", "PATCH", { id, name: trimmed });
      await load();
      setMessage("تم تحديث اسم القسم");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل التحديث");
    }
  }

  async function onToggleUnderCeo(dept: Department, next: boolean) {
    setBusyId(dept._id);
    setError("");
    setMessage("");
    try {
      await apiSend("/api/departments", "PATCH", {
        id: dept._id,
        underCeo: next,
      });
      await load();
      setMessage(
        next
          ? `تم وضع القسم تحت سيطرة ${ROLE_LABELS.ceo}`
          : "تم إلغاء سيطرة المدير التنفيذي عن القسم"
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل التحديث");
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(dept: Department) {
    if (
      !window.confirm(
        `هل تريد حذف قسم «${dept.name}»؟\nلا يمكن الحذف إذا كان مرتبطًا بمستخدمين أو مهام.`
      )
    ) {
      return;
    }
    setDeletingId(dept._id);
    setError("");
    try {
      const res = await apiSend<{ message?: string }>(
        `/api/departments/${dept._id}`,
        "DELETE"
      );
      await load();
      setMessage(res.message || "تم حذف القسم");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الحذف");
    } finally {
      setDeletingId(null);
    }
  }

  if (authStatus === "loading" || session?.user?.role !== "hr") {
    return <p className="text-[var(--muted)]">جارٍ التحميل...</p>;
  }

  return (
    <div>
      <PageHeader
        title="إدارة الأقسام"
        subtitle="أضف أقسامًا جديدة أو عدّل أو احذف الأقسام — ويمكن وضع القسم تحت سيطرة المدير التنفيذي"
      />
      {error ? <p className="mb-3 text-[var(--danger)]">{error}</p> : null}
      {message ? <p className="mb-3 text-[var(--ok)]">{message}</p> : null}

      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="اسم القسم أو المدير..."
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.length === 0 ? (
            <div className="card col-span-full p-6 text-[var(--muted)]">
              {query.trim()
                ? "لا نتائج مطابقة للبحث"
                : "لا توجد أقسام بعد"}
            </div>
          ) : (
            filtered.map((d) => {
              const isSystem = d.name === CEO_DEPARTMENT_NAME;
              return (
                <div key={d._id} className="card p-4">
                  <div className="field">
                    <label htmlFor={`dept-${d._id}`}>اسم القسم</label>
                    <input
                      id={`dept-${d._id}`}
                      defaultValue={d.name}
                      disabled={isSystem}
                      onBlur={(e) => onRename(d._id, e.target.value, d.name)}
                    />
                  </div>
                  <div className="mt-3 text-sm text-[var(--muted)]">
                    {d.underCeo
                      ? `تحت ${ROLE_LABELS.ceo} مباشرة`
                      : `المدير: ${d.managerId?.name || "غير معيّن"}`}
                  </div>
                  <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(d.underCeo)}
                      disabled={isSystem || busyId === d._id}
                      onChange={(e) =>
                        onToggleUnderCeo(d, e.target.checked)
                      }
                    />
                    <span>تحت سيطرة {ROLE_LABELS.ceo}</span>
                  </label>
                  <button
                    type="button"
                    className="btn btn-secondary mt-4 w-full text-sm text-[var(--danger)]"
                    disabled={deletingId === d._id || isSystem}
                    onClick={() => onDelete(d)}
                  >
                    {deletingId === d._id ? "جارٍ الحذف..." : "حذف القسم"}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <form onSubmit={onAdd} className="card h-fit space-y-3 p-4">
          <h3 className="font-semibold">إضافة قسم جديد</h3>
          <div className="field">
            <label htmlFor="new-dept">اسم القسم</label>
            <input
              id="new-dept"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              maxLength={80}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={underCeo}
              onChange={(e) => setUnderCeo(e.target.checked)}
            />
            <span>تحت سيطرة {ROLE_LABELS.ceo}</span>
          </label>
          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
          >
            {loading ? "جارٍ الحفظ..." : "إضافة القسم"}
          </button>
          <p className="text-xs text-[var(--muted)]">
            {underCeo
              ? `القسم سيكون تحت ${ROLE_LABELS.ceo} مباشرة (مثل العقود الخارجية) بدون مدير.`
              : "بعد إنشاء القسم عيّن مديرًا له من صفحة المدراء."}
          </p>
        </form>
      </div>
    </div>
  );
}
