"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/PageHeader";
import {
  ConfirmDialog,
  deleteUserConfirmMessage,
} from "@/components/ConfirmDialog";
import { PasswordField } from "@/components/PasswordField";
import { matchesSearch, SearchField } from "@/components/SearchField";
import { LoginPasswordLine } from "@/components/LoginPasswordLine";
import { useSuccessToast } from "@/components/SuccessToast";
import { apiGet, apiSend } from "@/lib/client";

interface TeamUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  loginPassword?: string | null;
  departmentId?: { _id?: string; name?: string };
  managedDepartments?: Array<{ _id: string; name: string }>;
}

interface Department {
  _id: string;
  name: string;
  underCeo?: boolean;
  managerId?: { _id?: string; name?: string } | null;
}

export default function HrManagersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const showSuccess = useSuccessToast();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [newDeptName, setNewDeptName] = useState("");
  const [editing, setEditing] = useState<TeamUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editDeptIds, setEditDeptIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<TeamUser | null>(null);

  const managers = useMemo(
    () =>
      users.filter((u) => {
        if (u.role !== "manager") return false;
        const deptNames = (u.managedDepartments || [])
          .map((d) => d.name)
          .concat(u.departmentId?.name || "");
        return matchesSearch(query, u.name, u.email, ...deptNames);
      }),
    [users, query]
  );

  const managerDepartments = useMemo(
    () => departments.filter((d) => !d.underCeo),
    [departments]
  );

  async function load() {
    const data = await apiGet<{ users: TeamUser[]; departments: Department[] }>(
      "/api/team"
    );
    setUsers(data.users);
    setDepartments(data.departments);
  }

  useEffect(() => {
    if (status === "loading") return;
    if (session?.user?.role !== "hr") {
      router.replace("/dashboard");
      return;
    }
    load().catch((e) => setError(e.message));
  }, [status, session?.user?.role, router]);

  function toggleDept(
    id: string,
    list: string[],
    setList: (v: string[]) => void
  ) {
    setList(
      list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
    );
  }

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");
    const trimmedNew = newDeptName.trim();
    if (selectedDeptIds.length === 0 && trimmedNew.length < 2) {
      setError("اختر قسمًا واحدًا على الأقل أو أدخل اسم قسم جديد");
      return;
    }
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    setLoading(true);
    try {
      await apiSend("/api/team", "POST", {
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
        role: "manager",
        departmentIds: selectedDeptIds,
        ...(trimmedNew.length >= 2
          ? { newDepartmentName: trimmedNew }
          : {}),
      });
      formEl.reset();
      setSelectedDeptIds([]);
      setNewDeptName("");
      await load();
      showSuccess("تم إضافة المدير بنجاح");
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
    const ids =
      u.managedDepartments?.map((d) => d._id) ||
      (u.departmentId?._id ? [u.departmentId._id] : []);
    setEditDeptIds(ids);
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (editDeptIds.length === 0) {
      setError("اختر قسمًا واحدًا على الأقل");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiSend(`/api/team/${editing._id}`, "PATCH", {
        name: editName,
        email: editEmail,
        departmentIds: editDeptIds,
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

  async function onDelete() {
    if (!pendingDelete) return;
    setBusy(true);
    setError("");
    try {
      await apiSend(`/api/team/${pendingDelete._id}`, "DELETE");
      if (editing?._id === pendingDelete._id) setEditing(null);
      setPendingDelete(null);
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
        subtitle="يمكن ربط المدير بأكثر من قسم"
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
              {query.trim() ? "لا نتائج مطابقة للبحث" : "لا يوجد مدراء بعد"}
            </div>
          ) : (
            managers.map((u) => {
              const depts =
                u.managedDepartments && u.managedDepartments.length > 0
                  ? u.managedDepartments.map((d) => d.name).join(" · ")
                  : u.departmentId?.name || "بدون قسم";
              return (
                <article
                  key={u._id}
                  className="card flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div>
                    <div className="font-semibold">{u.name}</div>
                    <div className="text-sm text-[var(--muted)]">{u.email}</div>
                    <LoginPasswordLine password={u.loginPassword} />
                    <div className="mt-1 text-sm">{depts}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary text-sm"
                      onClick={() => openEdit(u)}
                    >
                      تعديل
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger text-sm"
                      disabled={busy}
                      onClick={() => setPendingDelete(u)}
                    >
                      حذف
                    </button>
                  </div>
                </article>
              );
            })
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
          <PasswordField
            name="password"
            label="كلمة المرور"
            required
            minLength={10}
            autoComplete="new-password"
          />
          <div className="field">
            <label>الأقسام (يمكن اختيار أكثر من واحد)</label>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-[var(--line)] p-2">
              {managerDepartments.length === 0 ? (
                <p className="text-xs text-[var(--muted)]">لا أقسام بعد — أنشئ قسمًا أدناه</p>
              ) : (
                managerDepartments.map((d) => (
                  <label
                    key={d._id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--brand-soft)]"
                  >
                    <input
                      type="checkbox"
                      checked={selectedDeptIds.includes(d._id)}
                      onChange={() =>
                        toggleDept(d._id, selectedDeptIds, setSelectedDeptIds)
                      }
                    />
                    <span>{d.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>
          <div className="field">
            <label>أو أنشئ قسمًا جديدًا مع المدير</label>
            <input
              value={newDeptName}
              onChange={(e) => setNewDeptName(e.target.value)}
              minLength={2}
              placeholder="اسم القسم الجديد (اختياري)"
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
          >
            {loading ? "جارٍ الحفظ..." : "حفظ المدير"}
          </button>
        </form>
      </div>

      {editing ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setEditing(null)}
        >
          <form
            className="card w-full max-w-lg space-y-3 p-5"
            onClick={(e) => e.stopPropagation()}
            onSubmit={onSaveEdit}
          >
            <h3 className="text-lg font-semibold">تعديل المدير</h3>
            <div className="field">
              <label>الاسم</label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
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
            <div className="field">
              <label>الأقسام المسؤولة</label>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-[var(--line)] p-2">
                {managerDepartments.map((d) => (
                  <label
                    key={d._id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--brand-soft)]"
                  >
                    <input
                      type="checkbox"
                      checked={editDeptIds.includes(d._id)}
                      onChange={() =>
                        toggleDept(d._id, editDeptIds, setEditDeptIds)
                      }
                    />
                    <span>{d.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <PasswordField
              label="كلمة مرور جديدة (اختياري)"
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
              minLength={10}
              autoComplete="new-password"
            />
            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary" disabled={busy}>
                حفظ
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditing(null)}
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="تأكيد حذف المدير"
        message={
          pendingDelete
            ? deleteUserConfirmMessage("المدير", pendingDelete.name)
            : ""
        }
        busy={busy}
        onCancel={() => {
          if (!busy) setPendingDelete(null);
        }}
        onConfirm={onDelete}
      />
    </div>
  );
}
