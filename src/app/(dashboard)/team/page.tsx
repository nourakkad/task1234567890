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
}

export default function TeamPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const role = session?.user?.role;

  async function load() {
    const data = await apiGet<{ users: TeamUser[]; departments: Department[] }>(
      "/api/team"
    );
    setUsers(data.users);
    setDepartments(data.departments);
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

    setLoading(true);
    try {
      await apiSend("/api/team", "POST", {
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
        role: createRole,
        departmentId:
          role === "ceo" ? form.get("departmentId") || undefined : undefined,
      });
      e.currentTarget.reset();
      await load();
      setMessage(
        createRole === "manager" ? "تم إضافة المدير" : "تم إضافة الموظف"
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
            ? "أضف مدراء الأقسام — المدراء يضيفون موظفيهم"
            : "أضف موظفين تابعين لقسمك"
        }
      />
      {error ? <p className="mb-3 text-[var(--danger)]">{error}</p> : null}
      {message ? <p className="mb-3 text-[var(--ok)]">{message}</p> : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
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
            <div className="field">
              <label htmlFor="departmentId">القسم</label>
              <select id="departmentId" name="departmentId" required>
                <option value="">اختر القسم</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
              </select>
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
