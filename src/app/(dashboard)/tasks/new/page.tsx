"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AssigneePicker } from "@/components/AssigneePicker";
import { PageHeader } from "@/components/PageHeader";
import { useSuccessToast } from "@/components/SuccessToast";
import { apiGet, apiSend } from "@/lib/client";

interface AssignableUser {
  _id: string;
  name: string;
  role: string;
  contractType?: string;
  departmentId?: { _id: string; name: string } | string | null;
  managedDepartments?: Array<{ _id: string; name: string }>;
}

interface Department {
  _id: string;
  name: string;
}

function todayInputDate() {
  return new Date().toISOString().slice(0, 10);
}

function userDeptId(user?: AssignableUser | null): string {
  if (!user?.departmentId) return "";
  return typeof user.departmentId === "string"
    ? user.departmentId
    : user.departmentId._id;
}

export default function NewTaskPage() {
  const router = useRouter();
  const showSuccess = useSuccessToast();
  const { data: session, status: authStatus } = useSession();
  const role = session?.user?.role;
  const isGm = role === "general_manager";
  const isCeo = role === "ceo";
  const isManager = role === "manager";
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    ownerId: "",
    departmentId: "",
    targetDate: "",
    managementDecision: "",
  });

  const managerDeptIds = session?.user?.departmentIds || [];
  const managerDepartments = useMemo(() => {
    if (!isManager) return [];
    if (managerDeptIds.length > 0) {
      const filtered = departments.filter((d) =>
        managerDeptIds.includes(d._id)
      );
      return filtered.length > 0 ? filtered : departments;
    }
    return departments;
  }, [isManager, managerDeptIds, departments]);

  const managerNeedsDeptFirst = isManager && managerDepartments.length > 1;

  const selectedOwner = users.find((u) => u._id === form.ownerId);
  const isExternalOwner =
    selectedOwner?.role === "employee" &&
    selectedOwner.contractType === "external";
  const ownerNeedsNoDept =
    selectedOwner?.role === "ceo" || selectedOwner?.role === "hr";

  useEffect(() => {
    if (authStatus === "loading") {
      setListLoading(true);
      return;
    }
    if (authStatus !== "authenticated") {
      setListLoading(false);
      setUsers([]);
      setDepartments([]);
      return;
    }

    let cancelled = false;
    setListLoading(true);
    setError("");

    Promise.all([
      apiGet<AssignableUser[]>("/api/users/assignable"),
      apiGet<Department[]>("/api/departments"),
    ])
      .then(([u, d]) => {
        if (cancelled) return;
        const list = Array.isArray(u) ? u : [];
        setUsers(
          list.map((row) => ({
            ...row,
            _id: String(row._id),
          }))
        );
        const depts = Array.isArray(d) ? d : [];
        setDepartments(depts);

        if (isManager) {
          const ids = session?.user?.departmentIds || [];
          if (ids.length === 1) {
            setForm((f) => ({ ...f, departmentId: ids[0] }));
          } else if (ids.length === 0 && session?.user?.departmentId) {
            setForm((f) => ({
              ...f,
              departmentId: session.user!.departmentId as string,
            }));
          }
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setUsers([]);
          setError(e.message);
        }
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    authStatus,
    isManager,
    session?.user?.departmentId,
    session?.user?.departmentIds,
  ]);

  /** Employees shown to a manager (filtered by selected department when multi-dept). */
  const managerVisibleUsers = useMemo(() => {
    if (!isManager) return users;
    if (!form.departmentId) {
      return managerNeedsDeptFirst ? [] : users;
    }
    return users.filter((u) => userDeptId(u) === form.departmentId);
  }, [isManager, users, form.departmentId, managerNeedsDeptFirst]);

  /** Departments available after picking a non-manager-flow owner (CEO/GM). */
  const ownerDepartments = useMemo(() => {
    if (isManager) return [];
    if (selectedOwner?.role === "manager") {
      const managed = selectedOwner.managedDepartments || [];
      if (managed.length > 0) return managed;
    }
    if (selectedOwner?.departmentId) {
      const dept =
        typeof selectedOwner.departmentId === "string"
          ? departments.find((d) => d._id === selectedOwner.departmentId)
          : {
              _id: selectedOwner.departmentId._id,
              name: selectedOwner.departmentId.name,
            };
      return dept ? [dept] : [];
    }
    return [];
  }, [isManager, selectedOwner, departments]);

  const showOwnerDepartmentPicker =
    !isManager &&
    Boolean(selectedOwner) &&
    !ownerNeedsNoDept &&
    !isExternalOwner &&
    ownerDepartments.length > 1;

  function onManagerDepartmentChange(departmentId: string) {
    setForm((f) => {
      const stillValid =
        f.ownerId &&
        users.some(
          (u) => u._id === f.ownerId && userDeptId(u) === departmentId
        );
      return {
        ...f,
        departmentId,
        ownerId: stillValid ? f.ownerId : "",
      };
    });
  }

  function onOwnerChange(ownerId: string) {
    const owner = users.find((u) => u._id === ownerId);
    let departmentId = form.departmentId;

    if (isManager) {
      // Keep department already chosen (or single auto dept)
      if (!departmentId) {
        departmentId = userDeptId(owner) || managerDeptIds[0] || "";
      }
      setForm((f) => ({ ...f, ownerId, departmentId }));
      return;
    }

    departmentId = "";
    if (owner?.role === "manager") {
      const managed = owner.managedDepartments || [];
      if (managed.length === 1) departmentId = managed[0]._id;
      else if (managed.length > 1) departmentId = "";
      else if (owner.departmentId) {
        departmentId = userDeptId(owner);
      }
    } else if (owner?.departmentId) {
      departmentId = userDeptId(owner);
    }
    setForm((f) => ({ ...f, ownerId, departmentId }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (managerNeedsDeptFirst && !form.departmentId) {
      setError("اختر القسم أولًا");
      return;
    }
    if (!form.ownerId) {
      setError("اختر المسؤول من القائمة");
      return;
    }
    const orderText = form.managementDecision.trim();
    if (!orderText) {
      setError("أدخل الأمر");
      return;
    }
    if (showOwnerDepartmentPicker && !form.departmentId) {
      setError("اختر القسم");
      return;
    }
    if (!form.targetDate) {
      setError("أدخل تاريخ التسليم");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const task = await apiSend<{ _id: string }>("/api/tasks", "POST", {
        name: form.name.trim(),
        description: form.description.trim(),
        ownerId: form.ownerId,
        departmentId: form.departmentId || undefined,
        priority: "متوسطة",
        status: "لم تبدأ",
        assignedDate: todayInputDate(),
        targetDate: form.targetDate,
        managementDecision: isGm || isCeo ? orderText : "",
        nextAction: orderText,
        progress: 0,
      });
      showSuccess("تم إضافة المهمة بنجاح");
      if (isGm) router.push(`/track/${task._id}`);
      else if (isCeo) router.push(`/track/${task._id}`);
      else if (isManager) router.push(`/team-tasks/${task._id}`);
      else router.push(`/my-tasks/${task._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الحفظ");
      setLoading(false);
    }
  }

  const title = isGm
    ? "تكليف تنفيذي / موارد بشرية / مدير"
    : isCeo
      ? "تكليف موارد بشرية أو مدير أو عقد خارجي"
      : "تكليف موظف بمهمة";

  const subtitle = isGm
    ? "المدير العام يسند المهام للمدير التنفيذي والموارد البشرية والمدراء وموظفي العقود الخارجية"
    : isCeo
      ? "المدير التنفيذي يسند المهام للموارد البشرية والمدراء وموظفي العقود الخارجية"
      : "المدير يسند المهام لموظفي فريقه مع أمر واضح";

  const ownerLabel = isGm
    ? "المسؤول (تنفيذي / موارد بشرية / مدير / عقد خارجي)"
    : isCeo
      ? "المسؤول (موارد بشرية / مدير / عقد خارجي)"
      : "الموظف المسؤول";

  const visibleAssignees = isManager ? managerVisibleUsers : users;

  if (authStatus === "loading") {
    return <p className="text-[var(--muted)]">جارٍ التحميل...</p>;
  }

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} />
      <form
        onSubmit={onSubmit}
        className="card grid max-w-3xl gap-4 p-5 md:grid-cols-2"
      >
        <div className="field md:col-span-2">
          <label>عنوان المهمة</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="عنوان مختصر للمهمة"
          />
        </div>

        {isManager ? (
          <>
            {managerNeedsDeptFirst ? (
              <div className="field md:col-span-2">
                <label>القسم</label>
                <select
                  required
                  value={form.departmentId}
                  onChange={(e) => onManagerDepartmentChange(e.target.value)}
                >
                  <option value="">اختر القسم أولًا...</option>
                  {managerDepartments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  بعد اختيار القسم تظهر موظفو هذا القسم فقط
                </p>
              </div>
            ) : null}

            <div className="field md:col-span-2">
              <label>{ownerLabel}</label>
              <AssigneePicker
                users={visibleAssignees}
                value={form.ownerId}
                onChange={onOwnerChange}
                loading={listLoading}
                emptyLabel={
                  managerNeedsDeptFirst && !form.departmentId
                    ? "اختر القسم أولًا لعرض الموظفين"
                    : managerNeedsDeptFirst && form.departmentId
                      ? "لا يوجد موظفون في هذا القسم"
                      : "لا يوجد موظفون مرتبطون بك كمدير — اطلب من الموارد البشرية ربطهم بحسابك"
                }
              />
              {!listLoading && form.ownerId ? (
                <p className="mt-1 text-xs text-[var(--muted)]">
                  المختار: {selectedOwner?.name || ""}
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <div className="field md:col-span-2">
              <label>{ownerLabel}</label>
              <AssigneePicker
                users={users}
                value={form.ownerId}
                onChange={onOwnerChange}
                loading={listLoading}
                emptyLabel="لا يوجد أشخاص متاحون للإسناد"
              />
              {!listLoading && users.length > 0 ? (
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {form.ownerId
                    ? `المختار: ${selectedOwner?.name || ""}`
                    : `اضغط لاختيار شخص من القائمة (${users.length})`}
                </p>
              ) : null}
            </div>

            {showOwnerDepartmentPicker ? (
              <div className="field md:col-span-2">
                <label>القسم</label>
                <select
                  required
                  value={form.departmentId}
                  onChange={(e) =>
                    setForm({ ...form, departmentId: e.target.value })
                  }
                >
                  <option value="">اختر القسم...</option>
                  {ownerDepartments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {isExternalOwner ? (
              <div className="md:col-span-2 rounded-xl border border-[var(--line)] bg-[var(--brand-soft)] px-3 py-2.5 text-sm font-semibold text-[var(--brand)]">
                عقد خارجي
              </div>
            ) : null}
          </>
        )}

        <div className="field md:col-span-2">
          <label>الأمر</label>
          <textarea
            rows={4}
            value={form.managementDecision}
            onChange={(e) =>
              setForm({
                ...form,
                managementDecision: e.target.value,
              })
            }
            placeholder="اكتب الأمر المطلوب تنفيذه..."
            required
          />
        </div>

        <div className="field">
          <label>تاريخ التسليم</label>
          <input
            type="date"
            required
            value={form.targetDate}
            min={todayInputDate()}
            onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
          />
        </div>

        <div className="field md:col-span-2">
          <label>الوصف (اختياري)</label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="تفاصيل إضافية إن وجدت..."
          />
        </div>

        {error ? (
          <p className="md:col-span-2 text-sm text-[var(--danger)]">{error}</p>
        ) : null}
        <div className="md:col-span-2 flex gap-2">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={
              loading ||
              listLoading ||
              !form.ownerId ||
              (managerNeedsDeptFirst && !form.departmentId)
            }
          >
            {loading ? "جارٍ الحفظ..." : "إسناد المهمة"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => router.back()}
          >
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}
