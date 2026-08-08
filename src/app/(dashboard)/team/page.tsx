"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/PageHeader";
import { ROLE_LABELS, type UserRole } from "@/constants/lookups";
import { apiGet, apiSend } from "@/lib/client";

interface TeamUser {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId?: { name: string };
  managerId?: { name: string };
}

interface Department {
  _id: string;
  name: string;
  managerId?: { _id?: string; name?: string } | null;
}

export default function TeamPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [deptMode, setDeptMode] = useState<"existing" | "new">("existing");
  const [selectedDeptId, setSelectedDeptId] = useState("");
  const [newDeptName, setNewDeptName] = useState("");
  const role = session?.user?.role;

  async function load() {
    const data = await apiGet<{ users: TeamUser[]; departments: Department[] }>(
      "/api/team"
    );
    setUsers(data.users);
    setDepartments(data.departments);
    if (data.departments.length === 0) {
      setDeptMode("new");
    }
  }

  useEffect(() => {
    if (authStatus === "loading") return;
    if (!session) {
      router.replace("/login");
      return;
    }
    if (role !== "ceo" && role !== "manager") {
      setError("هذه الصفحة للمدير التنفيذي والمدراء فقط");
      return;
    }
    load().catch((e) => setError(e.message));
  }, [authStatus, session, role, router]);

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");
    const form = new FormData(e.currentTarget);
    const createRole = role === "ceo" ? "manager" : "employee";

    if (role === "ceo") {
      if (deptMode === "existing" && !selectedDeptId) {
        setError("اختر قسمًا موجودًا أو أنشئ قسمًا جديدًا");
        return;
      }
      if (deptMode === "new" && newDeptName.trim().length < 2) {
        setError("أدخل اسم القسم الجديد");
        return;
      }
    }

    setLoading(true);
    try {
      await apiSend("/api/team", "POST", {
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
        role: createRole,
        ...(role === "ceo"
          ? deptMode === "new"
            ? { newDepartmentName: newDeptName.trim() }
            : { departmentId: selectedDeptId }
          : {}),
      });
      e.currentTarget.reset();
      setSelectedDeptId("");
      setNewDeptName("");
      setDeptMode(departments.length ? "existing" : "new");
      await load();
      setMessage(
        createRole === "manager" ? "تم إضافة المدير والقسم" : "تم إضافة الموظف"
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الإضافة");
    } finally {
      setLoading(false);
    }
  }

  if (authStatus === "loading") {
    return <p className="text-[var(--muted)]">جارٍ التحميل...</p>;
  }

  if (role !== "ceo" && role !== "manager") {
    return (
      <div className="card p-6 text-[var(--danger)]">
        هذه الصفحة للمدير التنفيذي والمدراء فقط
      </div>
    );
  }

  const isCeo = role === "ceo";

  return (
    <div>
      <PageHeader
        title={isCeo ? "إدارة المدراء" : "إدارة الفريق"}
        subtitle={
          isCeo
            ? "أضف مديرًا مع قسم موجود أو قسم جديد"
            : "أضف موظفين تابعين لقسمك"
        }
      />
      {error ? <p className="mb-3 text-[var(--danger)]">{error}</p> : null}
      {message ? <p className="mb-3 text-[var(--ok)]">{message}</p> : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <div className="card table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>البريد</th>
                  <th>الدور</th>
                  <th>القسم</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-[var(--muted)]">
                      لا يوجد أعضاء بعد
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u._id}>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td>{ROLE_LABELS[u.role]}</td>
                      <td>{u.departmentId?.name || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {isCeo && departments.length > 0 ? (
            <div className="card p-4">
              <h3 className="mb-3 font-semibold">الأقسام</h3>
              <ul className="space-y-2 text-sm">
                {departments.map((d) => (
                  <li
                    key={d._id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-2 last:border-0"
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
            </div>
          ) : null}
        </div>

        <form onSubmit={onCreate} className="card space-y-3 p-4">
          <h3 className="font-semibold">
            {isCeo ? "إضافة مدير" : "إضافة موظف"}
          </h3>
          <div className="field">
            <label htmlFor="name">الاسم</label>
            <input id="name" name="name" required />
          </div>
          <div className="field">
            <label htmlFor="email">البريد</label>
            <input id="email" name="email" type="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">كلمة المرور</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={10}
              autoComplete="new-password"
            />
            <p className="mt-1 text-xs text-[var(--muted)]">
              10 أحرف على الأقل، حروف وأرقام
            </p>
          </div>

          {isCeo ? (
            <div className="space-y-3 rounded-xl border border-[var(--line)] p-3">
              <div className="text-sm font-semibold">القسم</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`btn text-sm ${
                    deptMode === "existing"
                      ? "btn-primary"
                      : "btn-secondary"
                  }`}
                  onClick={() => setDeptMode("existing")}
                  disabled={departments.length === 0}
                >
                  قسم موجود
                </button>
                <button
                  type="button"
                  className={`btn text-sm ${
                    deptMode === "new" ? "btn-primary" : "btn-secondary"
                  }`}
                  onClick={() => setDeptMode("new")}
                >
                  قسم جديد
                </button>
              </div>

              {deptMode === "existing" ? (
                <div className="field">
                  <label htmlFor="departmentId">اختر القسم</label>
                  <select
                    id="departmentId"
                    value={selectedDeptId}
                    onChange={(e) => setSelectedDeptId(e.target.value)}
                    required={deptMode === "existing"}
                  >
                    <option value="">— اختر —</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name}
                        {d.managerId?.name
                          ? ` (المدير الحالي: ${d.managerId.name})`
                          : " (بدون مدير)"}
                      </option>
                    ))}
                  </select>
                  {departments.length === 0 ? (
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      لا توجد أقسام بعد — أنشئ قسمًا جديدًا
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="field">
                  <label htmlFor="newDepartmentName">اسم القسم الجديد</label>
                  <input
                    id="newDepartmentName"
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    placeholder="مثال: المشتريات"
                    required={deptMode === "new"}
                    minLength={2}
                    maxLength={80}
                  />
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              سيتم ربط الموظف بقسمك وتحت إدارتك تلقائيًا.
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
          >
            {loading
              ? "جارٍ الحفظ..."
              : isCeo
                ? "حفظ المدير"
                : "حفظ الموظف"}
          </button>
        </form>
      </div>
    </div>
  );
}
