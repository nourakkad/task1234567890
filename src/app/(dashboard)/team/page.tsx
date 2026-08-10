"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/PageHeader";
import { PasswordField } from "@/components/PasswordField";
import { matchesSearch, SearchField } from "@/components/SearchField";
import { ROLE_LABELS, type UserRole } from "@/constants/lookups";
import { apiGet, apiSend } from "@/lib/client";
import { formatScoreAvg } from "@/lib/format";

interface TeamUser {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId?: { name?: string };
  managerId?: { name?: string };
  avgScore?: number | null;
  reviewCount?: number;
}

interface Department {
  _id: string;
  name: string;
  managerId?: { name?: string } | null;
}

export default function TeamViewPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [performanceMonth, setPerformanceMonth] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingHr, setEditingHr] = useState<TeamUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [query, setQuery] = useState("");
  const role = session?.user?.role;

  const load = useCallback(async () => {
    const data = await apiGet<{
      users: TeamUser[];
      departments: Department[];
      performanceMonth?: string;
    }>("/api/team");
    setUsers(data.users);
    setDepartments(data.departments);
    setPerformanceMonth(data.performanceMonth || "");
  }, []);

  useEffect(() => {
    if (authStatus === "loading") return;
    if (!session) {
      router.replace("/login");
      return;
    }
    if (role === "hr") {
      router.replace("/hr");
      return;
    }
    if (role !== "ceo" && role !== "manager") {
      setError("غير مصرح");
      return;
    }
    load().catch((e) => setError(e.message));
  }, [authStatus, session, role, router, load]);

  const hrUsers = useMemo(
    () =>
      users.filter(
        (u) =>
          u.role === "hr" &&
          matchesSearch(query, u.name, u.email, ROLE_LABELS[u.role])
      ),
    [users, query]
  );
  const managers = useMemo(
    () =>
      users.filter(
        (u) =>
          u.role === "manager" &&
          matchesSearch(
            query,
            u.name,
            u.email,
            u.departmentId?.name,
            ROLE_LABELS[u.role]
          )
      ),
    [users, query]
  );
  const employees = useMemo(
    () =>
      users.filter(
        (u) =>
          u.role === "employee" &&
          matchesSearch(
            query,
            u.name,
            u.email,
            u.departmentId?.name,
            u.managerId?.name,
            ROLE_LABELS[u.role]
          )
      ),
    [users, query]
  );
  const filteredDepartments = useMemo(
    () =>
      departments.filter((d) =>
        matchesSearch(query, d.name, d.managerId?.name)
      ),
    [departments, query]
  );

  async function onCreateHr(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const form = new FormData(e.currentTarget);
    try {
      await apiSend("/api/team", "POST", {
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
        role: "hr",
      });
      e.currentTarget.reset();
      await load();
      setMessage("تم إضافة حساب الموارد البشرية");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الإضافة");
    } finally {
      setBusy(false);
    }
  }

  function openEditHr(u: TeamUser) {
    setEditingHr(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditPassword("");
    setError("");
    setMessage("");
  }

  async function onSaveHr(e: FormEvent) {
    e.preventDefault();
    if (!editingHr) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await apiSend(`/api/team/${editingHr._id}`, "PATCH", {
        name: editName,
        email: editEmail,
        ...(editPassword.trim() ? { password: editPassword } : {}),
      });
      setEditingHr(null);
      await load();
      setMessage("تم تحديث حساب الموارد البشرية");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل التحديث");
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteHr(u: TeamUser) {
    if (!window.confirm(`حذف حساب الموارد البشرية «${u.name}»؟`)) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await apiSend(`/api/team/${u._id}`, "DELETE");
      if (editingHr?._id === u._id) setEditingHr(null);
      await load();
      setMessage("تم حذف حساب الموارد البشرية");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الحذف");
    } finally {
      setBusy(false);
    }
  }

  if (authStatus === "loading" || role === "hr") {
    return <p className="text-[var(--muted)]">جارٍ التحميل...</p>;
  }

  if (role !== "ceo" && role !== "manager") {
    return (
      <div className="card p-6 text-[var(--danger)]">غير مصرح بعرض هذه الصفحة</div>
    );
  }

  const isCeo = role === "ceo";
  const monthHint = performanceMonth
    ? ` — متوسط تقييم الشهر (${performanceMonth})`
    : "";

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title={isCeo ? "عرض الفريق" : "عرض فريقك"}
        subtitle={
          isCeo
            ? `إدارة الموارد البشرية وعرض المدراء والموظفين${monthHint}`
            : `موظفو فريقك مع تقييم الأداء الشهري${monthHint}`
        }
      />
      {error ? <p className="mb-3 text-[var(--danger)]">{error}</p> : null}
      {message ? <p className="mb-3 text-[var(--ok)]">{message}</p> : null}

      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="الاسم، البريد، القسم، المدير..."
      />

      {isCeo ? (
        <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_320px]">
          <Section
            title="الموارد البشرية"
            empty={
              query.trim()
                ? "لا نتائج مطابقة للبحث"
                : "لا يوجد مستخدمو موارد بشرية"
            }
            users={hrUsers}
            showManager={false}
            showRating
            onEdit={openEditHr}
            onDelete={onDeleteHr}
            busy={busy}
          />
          <form onSubmit={onCreateHr} className="card h-fit space-y-3 p-4">
            <h3 className="font-semibold">إضافة موارد بشرية</h3>
            <div className="field">
              <label>الاسم</label>
              <input name="name" required minLength={2} />
            </div>
            <div className="field">
              <label>البريد</label>
              <input name="email" type="email" required />
            </div>
            <PasswordField
              name="password"
              label="كلمة المرور"
              required
              minLength={10}
              autoComplete="new-password"
            />
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={busy}
            >
              إضافة
            </button>
          </form>
        </div>
      ) : null}

      {isCeo ? (
        <Section
          title="المدراء"
          empty={query.trim() ? "لا نتائج مطابقة للبحث" : "لا يوجد مدراء"}
          users={managers}
          showManager={false}
          showRating
        />
      ) : null}
      <Section
        title={isCeo ? "الموظفون" : "موظفو فريقك"}
        empty={query.trim() ? "لا نتائج مطابقة للبحث" : "لا يوجد موظفون"}
        users={employees}
        showManager={isCeo}
        showRating
      />

      {isCeo && departments.length > 0 ? (
        <div className="card mt-4 p-4">
          <h3 className="mb-3 font-semibold">الأقسام</h3>
          {filteredDepartments.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">لا نتائج مطابقة للبحث</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {filteredDepartments.map((d) => (
                <li
                  key={d._id}
                  className="flex flex-wrap justify-between gap-2 border-b border-[var(--line)] pb-2 last:border-0"
                >
                  <span className="font-medium">{d.name}</span>
                  <span className="text-[var(--muted)]">
                    {d.managerId?.name
                      ? `المدير: ${d.managerId.name}`
                      : "بدون مدير"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {editingHr ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={() => !busy && setEditingHr(null)}
        >
          <form
            onSubmit={onSaveHr}
            className="card w-full max-w-md space-y-3 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">تعديل الموارد البشرية</h3>
            <div className="field">
              <label>الاسم</label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                minLength={2}
              />
            </div>
            <div className="field">
              <label>البريد</label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                required
              />
            </div>
            <PasswordField
              label="كلمة مرور جديدة (اختياري)"
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
              minLength={10}
              autoComplete="new-password"
            />
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn btn-primary" disabled={busy}>
                حفظ
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => setEditingHr(null)}
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function Section({
  title,
  empty,
  users,
  showManager,
  showRating,
  onEdit,
  onDelete,
  busy,
}: {
  title: string;
  empty: string;
  users: TeamUser[];
  showManager: boolean;
  showRating?: boolean;
  onEdit?: (u: TeamUser) => void;
  onDelete?: (u: TeamUser) => void;
  busy?: boolean;
}) {
  const canManage = Boolean(onEdit || onDelete);

  return (
    <div className="mb-4">
      <h3 className="mb-3 text-lg font-semibold">{title}</h3>
      {users.length === 0 ? (
        <div className="card p-5 text-[var(--muted)]">{empty}</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {users.map((u) => (
            <article key={u._id} className="card space-y-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold">{u.name}</div>
                  <div className="break-all text-sm text-[var(--muted)]">
                    {u.email}
                  </div>
                </div>
                {showRating ? (
                  <div className="shrink-0 text-end">
                    <div className="text-xs text-[var(--muted)]">التقييم /10</div>
                    <div className="text-2xl font-bold text-[var(--brand)]">
                      {formatScoreAvg(u.avgScore)}
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {(u.reviewCount ?? 0) > 0
                        ? `${u.reviewCount} تقييم`
                        : "لا تقييمات"}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="badge badge-teal">{ROLE_LABELS[u.role]}</span>
                <span className="badge badge-slate">
                  {u.departmentId?.name || "بدون قسم"}
                </span>
              </div>
              {showManager ? (
                <div className="text-sm text-[var(--muted)]">
                  المدير: {u.managerId?.name || "—"}
                </div>
              ) : null}
              {canManage ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {onEdit ? (
                    <button
                      type="button"
                      className="btn btn-secondary text-sm"
                      disabled={busy}
                      onClick={() => onEdit(u)}
                    >
                      تعديل
                    </button>
                  ) : null}
                  {onDelete ? (
                    <button
                      type="button"
                      className="btn btn-danger text-sm"
                      disabled={busy}
                      onClick={() => onDelete(u)}
                    >
                      حذف
                    </button>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
