"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/PageHeader";
import { PasswordField } from "@/components/PasswordField";
import { matchesSearch, SearchField } from "@/components/SearchField";
import { apiGet, apiSend } from "@/lib/client";

interface TeamUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  departmentId?: { _id?: string; name?: string };
}

interface Department {
  _id: string;
  name: string;
  managerId?: { _id?: string; name?: string } | null;
}

export default function HrManagersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [deptMode, setDeptMode] = useState<"existing" | "new">("existing");
  const [selectedDeptId, setSelectedDeptId] = useState("");
  const [newDeptName, setNewDeptName] = useState("");
  const [editing, setEditing] = useState<TeamUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editDeptId, setEditDeptId] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");

  const managers = useMemo(
    () =>
      users.filter(
        (u) =>
          u.role === "manager" &&
          matchesSearch(query, u.name, u.email, u.departmentId?.name)
      ),
    [users, query]
  );

  async function load() {
    const data = await apiGet<{ users: TeamUser[]; departments: Department[] }>(
      "/api/team"
    );
    setUsers(data.users);
    setDepartments(data.departments);
    if (data.departments.length === 0) setDeptMode("new");
  }

  useEffect(() => {
    if (status === "loading") return;
    if (session?.user?.role !== "hr") {
      router.replace("/dashboard");
      return;
    }
    load().catch((e) => setError(e.message));
  }, [status, session?.user?.role, router]);

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (deptMode === "existing" && !selectedDeptId) {
      setError("اختر قسمًا أو أنشئ قسمًا جديدًا");
      return;
    }
    if (deptMode === "new" && newDeptName.trim().length < 2) {
      setError("أدخل اسم القسم الجديد");
      return;
    }
    const form = new FormData(e.currentTarget);
    setLoading(true);
    try {
      await apiSend("/api/team", "POST", {
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
        role: "manager",
        ...(deptMode === "new"
          ? { newDepartmentName: newDeptName.trim() }
          : { departmentId: selectedDeptId }),
      });
      e.currentTarget.reset();
      setSelectedDeptId("");
      setNewDeptName("");
      await load();
      setMessage("تم إضافة المدير");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الإضافة");
    } finally {
      setLoading(false);
    }
  }

  function openEdit(u: TeamUser) {
    setEditing(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditPassword("");
    setEditDeptId(u.departmentId?._id || "");
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError("");
    try {
      await apiSend(`/api/team/${editing._id}`, "PATCH", {
        name: editName,
        email: editEmail,
        departmentId: editDeptId,
        ...(editPassword.trim() ? { password: editPassword } : {}),
      });
      await load();
      setEditing(null);
      setMessage("تم تحديث المدير");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل التحديث");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(u: TeamUser) {
    if (!window.confirm(`حذف المدير «${u.name}»؟`)) return;
    setBusy(true);
    setError("");
    try {
      await apiSend(`/api/team/${u._id}`, "DELETE");
      if (editing?._id === u._id) setEditing(null);
      await load();
      setMessage("تم حذف المدير");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الحذف");
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading" || session?.user?.role !== "hr") {
    return <p className="text-[var(--muted)]">جارٍ التحميل...</p>;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="إدارة المدراء"
        subtitle="إنشاء وتعديل وحذف حسابات المدراء وربطهم بالأقسام"
      />
      {error ? <p className="mb-3 text-[var(--danger)]">{error}</p> : null}
      {message ? <p className="mb-3 text-[var(--ok)]">{message}</p> : null}

      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="الاسم، البريد، القسم..."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          {managers.length === 0 ? (
            <div className="card p-5 text-[var(--muted)]">
              {query.trim()
                ? "لا نتائج مطابقة للبحث"
                : "لا يوجد مدراء بعد"}
            </div>
          ) : (
            managers.map((u) => (
              <article key={u._id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <div className="font-semibold">{u.name}</div>
                  <div className="text-sm text-[var(--muted)]">{u.email}</div>
                  <div className="mt-1 text-sm">{u.departmentId?.name || "بدون قسم"}</div>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-secondary text-sm" onClick={() => openEdit(u)}>
                    تعديل
                  </button>
                  <button type="button" className="btn btn-danger text-sm" disabled={busy} onClick={() => onDelete(u)}>
                    حذف
                  </button>
                </div>
              </article>
            ))
          )}
        </div>

        <form onSubmit={onCreate} className="card h-fit space-y-3 p-4">
          <h3 className="font-semibold">إضافة مدير</h3>
          <div className="field">
            <label>الاسم</label>
            <input name="name" required />
          </div>
          <div className="field">
            <label>البريد</label>
            <input name="email" type="email" required />
          </div>
          <PasswordField name="password" label="كلمة المرور" required minLength={10} autoComplete="new-password" />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={`btn text-sm ${deptMode === "existing" ? "btn-primary" : "btn-secondary"}`} onClick={() => setDeptMode("existing")} disabled={!departments.length}>
              قسم موجود
            </button>
            <button type="button" className={`btn text-sm ${deptMode === "new" ? "btn-primary" : "btn-secondary"}`} onClick={() => setDeptMode("new")}>
              قسم جديد
            </button>
          </div>
          {deptMode === "existing" ? (
            <div className="field">
              <label>القسم</label>
              <select value={selectedDeptId} onChange={(e) => setSelectedDeptId(e.target.value)} required>
                <option value="">— اختر —</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="field">
              <label>اسم القسم الجديد</label>
              <input value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)} required minLength={2} />
            </div>
          )}
          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? "جارٍ الحفظ..." : "حفظ المدير"}
          </button>
        </form>
      </div>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <form className="card w-full max-w-lg space-y-3 p-5" onClick={(e) => e.stopPropagation()} onSubmit={onSaveEdit}>
            <h3 className="text-lg font-semibold">تعديل المدير</h3>
            <div className="field">
              <label>الاسم</label>
              <input value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>
            <div className="field">
              <label>البريد</label>
              <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label>القسم</label>
              <select value={editDeptId} onChange={(e) => setEditDeptId(e.target.value)} required>
                <option value="">— اختر —</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
            </div>
            <PasswordField label="كلمة مرور جديدة (اختياري)" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} minLength={10} autoComplete="new-password" />
            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary" disabled={busy}>حفظ</button>
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>إلغاء</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
