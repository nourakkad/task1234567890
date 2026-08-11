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
import {
  CEO_DEPARTMENT_NAME,
  CONTRACT_TYPE_LABELS,
  ROLE_LABELS,
  isCeoControlledDept,
  type ContractType,
} from "@/constants/lookups";
import { apiGet, apiSend } from "@/lib/client";

interface TeamUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  contractType?: ContractType;
  loginPassword?: string | null;
  departmentId?: { _id?: string; name?: string; underCeo?: boolean };
  managerId?: { _id?: string; name?: string };
  managedDepartments?: Array<{ _id: string; name: string }>;
}

interface Department {
  _id: string;
  name: string;
  underCeo?: boolean;
}

function underCeoLabel(u: TeamUser) {
  return (
    u.contractType === "external" || isCeoControlledDept(u.departmentId)
  );
}

export default function HrEmployeesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const showSuccess = useSuccessToast();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [contractType, setContractType] = useState<ContractType>("internal");
  const [managerId, setManagerId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [editing, setEditing] = useState<TeamUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editContractType, setEditContractType] =
    useState<ContractType>("internal");
  const [editManagerId, setEditManagerId] = useState("");
  const [editDeptId, setEditDeptId] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<TeamUser | null>(null);

  const managers = useMemo(
    () => users.filter((u) => u.role === "manager"),
    [users]
  );
  const ceoDepartments = useMemo(
    () => departments.filter((d) => isCeoControlledDept(d)),
    [departments]
  );
  const managerDepartments = useMemo(
    () => departments.filter((d) => !isCeoControlledDept(d)),
    [departments]
  );

  const selectedCreateDept = useMemo(
    () => departments.find((d) => d._id === departmentId),
    [departments, departmentId]
  );
  const createUnderCeo =
    contractType === "external" || isCeoControlledDept(selectedCreateDept);

  const selectedEditDept = useMemo(
    () => departments.find((d) => d._id === editDeptId),
    [departments, editDeptId]
  );
  const editUnderCeo =
    editContractType === "external" || isCeoControlledDept(selectedEditDept);

  const employees = useMemo(
    () =>
      users.filter(
        (u) =>
          u.role === "employee" &&
          matchesSearch(
            query,
            u.name,
            u.email,
            u.managerId?.name,
            u.departmentId?.name,
            u.contractType === "external"
              ? CONTRACT_TYPE_LABELS.external
              : CONTRACT_TYPE_LABELS.internal,
            underCeoLabel(u) ? ROLE_LABELS.ceo : ""
          )
      ),
    [users, query]
  );

  const managersForCreateDept = useMemo(() => {
    if (!departmentId || createUnderCeo) return [];
    return managers.filter((m) => {
      const managed = m.managedDepartments || [];
      if (managed.some((d) => d._id === departmentId)) return true;
      return m.departmentId?._id === departmentId;
    });
  }, [managers, departmentId, createUnderCeo]);

  const managersForEditDept = useMemo(() => {
    if (!editDeptId || editUnderCeo) return [];
    return managers.filter((m) => {
      const managed = m.managedDepartments || [];
      if (managed.some((d) => d._id === editDeptId)) return true;
      return m.departmentId?._id === editDeptId;
    });
  }, [managers, editDeptId, editUnderCeo]);

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

  useEffect(() => {
    if (contractType === "external") {
      setManagerId("");
      if (
        !departmentId ||
        !ceoDepartments.some((d) => d._id === departmentId)
      ) {
        const preferred =
          ceoDepartments.find((d) => d.name === CEO_DEPARTMENT_NAME) ||
          ceoDepartments[0];
        setDepartmentId(preferred?._id || "");
      }
      return;
    }
    if (isCeoControlledDept(selectedCreateDept)) {
      setManagerId("");
      return;
    }
    if (
      managerId &&
      managersForCreateDept.length > 0 &&
      !managersForCreateDept.some((m) => m._id === managerId)
    ) {
      setManagerId("");
    }
  }, [
    contractType,
    departmentId,
    ceoDepartments,
    selectedCreateDept,
    managerId,
    managersForCreateDept,
  ]);

  useEffect(() => {
    if (editContractType === "external") {
      setEditManagerId("");
      if (!editDeptId || !ceoDepartments.some((d) => d._id === editDeptId)) {
        const preferred =
          ceoDepartments.find((d) => d.name === CEO_DEPARTMENT_NAME) ||
          ceoDepartments[0];
        setEditDeptId(preferred?._id || "");
      }
      return;
    }
    if (isCeoControlledDept(selectedEditDept)) {
      setEditManagerId("");
      return;
    }
    if (
      editManagerId &&
      managersForEditDept.length > 0 &&
      !managersForEditDept.some((m) => m._id === editManagerId)
    ) {
      setEditManagerId("");
    }
  }, [
    editContractType,
    editDeptId,
    ceoDepartments,
    selectedEditDept,
    editManagerId,
    managersForEditDept,
  ]);

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!departmentId) {
      setError(
        contractType === "external" || createUnderCeo
          ? "اختر قسمًا تحت سيطرة المدير التنفيذي"
          : "اختر القسم"
      );
      return;
    }
    if (!createUnderCeo && !managerId) {
      setError("اختر المدير المسؤول");
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
        role: "employee",
        contractType,
        departmentId,
        ...(createUnderCeo ? {} : { managerId }),
      });
      formEl.reset();
      setContractType("internal");
      setManagerId("");
      setDepartmentId("");
      await load();
      showSuccess("تم إضافة الموظف بنجاح");
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
    setEditContractType(u.contractType === "external" ? "external" : "internal");
    setEditManagerId(u.managerId?._id || "");
    setEditDeptId(u.departmentId?._id || "");
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (!editDeptId) {
      setError(
        editContractType === "external" || editUnderCeo
          ? "اختر قسمًا تحت سيطرة المدير التنفيذي"
          : "اختر القسم"
      );
      return;
    }
    if (!editUnderCeo && !editManagerId) {
      setError("اختر المدير المسؤول");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiSend(`/api/team/${editing._id}`, "PATCH", {
        name: editName,
        email: editEmail,
        contractType: editContractType,
        departmentId: editDeptId,
        ...(editUnderCeo
          ? { managerId: null }
          : { managerId: editManagerId }),
        ...(editPassword.trim() ? { password: editPassword } : {}),
      });
      await load();
      setEditing(null);
      setMessage("تم تحديث الموظف");
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
      setMessage("تم حذف الموظف");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الحذف");
    } finally {
      setBusy(false);
    }
  }

  const createDeptList =
    contractType === "external" ? ceoDepartments : departments;
  const editDeptList =
    editContractType === "external" ? ceoDepartments : departments;

  const createDisabled =
    loading ||
    (contractType === "external" && !ceoDepartments.length) ||
    (contractType === "internal" &&
      !createUnderCeo &&
      managers.length === 0 &&
      managerDepartments.length === 0);

  if (status === "loading" || session?.user?.role !== "hr") {
    return <p className="text-[var(--muted)]">جارٍ التحميل...</p>;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="إدارة الموظفين"
        subtitle={`إنشاء وتعديل وحذف حسابات الموظفين وربطهم بمدير وقسم أو بأقسام تحت سيطرة ${ROLE_LABELS.ceo}`}
      />
      {error ? <p className="mb-3 text-[var(--danger)]">{error}</p> : null}
      {message ? <p className="mb-3 text-[var(--ok)]">{message}</p> : null}

      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="الاسم، البريد، المدير، القسم، نوع العقد..."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          {employees.length === 0 ? (
            <div className="card p-5 text-[var(--muted)]">
              {query.trim()
                ? "لا نتائج مطابقة للبحث"
                : "لا يوجد موظفون بعد"}
            </div>
          ) : (
            employees.map((u) => {
              const isExternal = u.contractType === "external";
              const underCeo = underCeoLabel(u);
              return (
                <article
                  key={u._id}
                  className="card flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div>
                    <div className="font-semibold">{u.name}</div>
                    <div className="text-sm text-[var(--muted)]">{u.email}</div>
                    <LoginPasswordLine password={u.loginPassword} />
                    <div className="mt-1 text-sm">
                      {CONTRACT_TYPE_LABELS[isExternal ? "external" : "internal"]}
                      {" · "}
                      {underCeo
                        ? `تحت ${ROLE_LABELS.ceo} مباشرة · ${u.departmentId?.name || "بدون قسم"}`
                        : `${u.managerId?.name || "بدون مدير"} · ${u.departmentId?.name || "بدون قسم"}`}
                    </div>
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
          <h3 className="font-semibold">إضافة موظف</h3>
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
            <label>نوع العقد</label>
            <select
              value={contractType}
              onChange={(e) =>
                setContractType(e.target.value as ContractType)
              }
            >
              <option value="internal">{CONTRACT_TYPE_LABELS.internal}</option>
              <option value="external">{CONTRACT_TYPE_LABELS.external}</option>
            </select>
          </div>

          <div className="field">
            <label>القسم</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              required
            >
              <option value="">— اختر —</option>
              {createDeptList.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                  {isCeoControlledDept(d) ? ` · تحت ${ROLE_LABELS.ceo}` : ""}
                </option>
              ))}
            </select>
          </div>

          {createUnderCeo ? (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--brand-soft)] px-3 py-3 text-sm">
              <div className="font-semibold">
                تحت {ROLE_LABELS.ceo} مباشرة
              </div>
              <div className="mt-1 text-[var(--muted)]">
                هذا القسم تحت سيطرة المدير التنفيذي — لا يلزم اختيار مدير
              </div>
            </div>
          ) : (
            <div className="field">
              <label>المدير المسؤول</label>
              <select
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                required
                disabled={!departmentId}
              >
                <option value="">
                  {departmentId ? "— اختر —" : "اختر القسم أولًا"}
                </option>
                {managersForCreateDept.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.name}
                  </option>
                ))}
              </select>
              {departmentId && managersForCreateDept.length === 0 ? (
                <p className="mt-1 text-xs text-[var(--muted)]">
                  لا يوجد مدير مرتبط بهذا القسم — عيّن مديرًا للقسم من صفحة
                  المدراء
                </p>
              ) : null}
            </div>
          )}

          {!ceoDepartments.length && contractType === "external" ? (
            <p className="text-xs text-[var(--muted)]">
              أنشئ قسمًا تحت سيطرة المدير التنفيذي من صفحة الأقسام أولًا
            </p>
          ) : null}

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={createDisabled}
          >
            {loading ? "جارٍ الحفظ..." : "حفظ الموظف"}
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
            <h3 className="text-lg font-semibold">تعديل الموظف</h3>
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
              <label>نوع العقد</label>
              <select
                value={editContractType}
                onChange={(e) =>
                  setEditContractType(e.target.value as ContractType)
                }
              >
                <option value="internal">{CONTRACT_TYPE_LABELS.internal}</option>
                <option value="external">{CONTRACT_TYPE_LABELS.external}</option>
              </select>
            </div>
            <div className="field">
              <label>القسم</label>
              <select
                value={editDeptId}
                onChange={(e) => setEditDeptId(e.target.value)}
                required
              >
                <option value="">— اختر —</option>
                {editDeptList.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                    {isCeoControlledDept(d) ? ` · تحت ${ROLE_LABELS.ceo}` : ""}
                  </option>
                ))}
              </select>
            </div>
            {editUnderCeo ? (
              <div className="rounded-xl border border-[var(--line)] bg-[var(--brand-soft)] px-3 py-3 text-sm">
                <div className="font-semibold">
                  تحت {ROLE_LABELS.ceo} مباشرة
                </div>
                <div className="mt-1 text-[var(--muted)]">
                  هذا القسم تحت سيطرة المدير التنفيذي — لا يلزم اختيار مدير
                </div>
              </div>
            ) : (
              <div className="field">
                <label>المدير</label>
                <select
                  value={editManagerId}
                  onChange={(e) => setEditManagerId(e.target.value)}
                  required
                  disabled={!editDeptId}
                >
                  <option value="">
                    {editDeptId ? "— اختر —" : "اختر القسم أولًا"}
                  </option>
                  {managersForEditDept.map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
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
        title="تأكيد حذف الموظف"
        message={
          pendingDelete
            ? deleteUserConfirmMessage("الموظف", pendingDelete.name)
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
