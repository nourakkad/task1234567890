"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AssigneePicker } from "@/components/AssigneePicker";
import { PageHeader } from "@/components/PageHeader";
import { useSuccessToast } from "@/components/SuccessToast";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/constants/lookups";
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
    priority: "متوسطة",
    status: "لم تبدأ",
    assignedDate: new Date().toISOString().slice(0, 10),
    targetDate: "",
    nextAction: "",
    managementDecision: "",
    progress: 0,
  });

  const selectedOwner = users.find((u) => u._id === form.ownerId);
  const isExternalOwner =
    selectedOwner?.role === "employee" &&
    selectedOwner.contractType === "external";
  const ownerNeedsNoDept =
    selectedOwner?.role === "ceo" || selectedOwner?.role === "hr";
  const deptRequired = !ownerNeedsNoDept && !isExternalOwner;

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
        setDepartments(Array.isArray(d) ? d : []);
        if (isManager) {
          const ids = session?.user?.departmentIds || [];
          const primary =
            ids[0] || session?.user?.departmentId || "";
          if (primary) {
            setForm((f) => ({ ...f, departmentId: primary }));
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

  const availableDepartments = useMemo(() => {
    if (isManager) {
      const ids = session?.user?.departmentIds || [];
      if (ids.length > 0) {
        const filtered = departments.filter((d) => ids.includes(d._id));
        return filtered.length > 0 ? filtered : departments;
      }
    }
    if (selectedOwner?.role === "manager") {
      const managed = selectedOwner.managedDepartments || [];
      if (managed.length > 0) return managed;
    }
    if (
      selectedOwner?.role === "employee" &&
      selectedOwner.contractType === "external" &&
      selectedOwner.departmentId
    ) {
      const dept =
        typeof selectedOwner.departmentId === "string"
          ? departments.find((d) => d._id === selectedOwner.departmentId)
          : {
              _id: selectedOwner.departmentId._id,
              name: selectedOwner.departmentId.name,
            };
      return dept ? [dept] : departments;
    }
    return departments;
  }, [
    isManager,
    session?.user?.departmentIds,
    departments,
    selectedOwner,
  ]);

  function onOwnerChange(ownerId: string) {
    const owner = users.find((u) => u._id === ownerId);
    let departmentId = "";
    if (owner?.role === "manager") {
      const managed = owner.managedDepartments || [];
      if (managed.length === 1) departmentId = managed[0]._id;
      else if (owner.departmentId) {
        departmentId =
          typeof owner.departmentId === "string"
            ? owner.departmentId
            : owner.departmentId._id;
      }
    } else if (owner?.departmentId) {
      departmentId =
        typeof owner.departmentId === "string"
          ? owner.departmentId
          : owner.departmentId._id;
    }
    setForm((f) => ({ ...f, ownerId, departmentId }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.ownerId) {
      setError("اختر المسؤول من القائمة");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const orderText = form.managementDecision.trim();
      const task = await apiSend<{ _id: string }>("/api/tasks", "POST", {
        ...form,
        departmentId: form.departmentId || undefined,
        managementDecision: isGm || isCeo ? orderText : "",
        nextAction: orderText || form.nextAction,
        progress: Number(form.progress) / 100,
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
      : "المدير يسند المهام لموظفي فريقه مع قرار/أمر واضح";

  const ownerLabel = isGm
    ? "المسؤول (تنفيذي / موارد بشرية / مدير / عقد خارجي)"
    : isCeo
      ? "المسؤول (موارد بشرية / مدير / عقد خارجي)"
      : "الموظف المسؤول";

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
          <label>اسم المهمة</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="field md:col-span-2">
          <label>وصف المهمة</label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div className="field md:col-span-2">
          <label>{ownerLabel}</label>
          <AssigneePicker
            users={users}
            value={form.ownerId}
            onChange={onOwnerChange}
            loading={listLoading}
            emptyLabel={
              isManager
                ? "لا يوجد موظفون مرتبطون بك كمدير — اطلب من الموارد البشرية ربطهم بحسابك"
                : "لا يوجد أشخاص متاحون للإسناد"
            }
          />
          {!listLoading && users.length > 0 ? (
            <p className="mt-1 text-xs text-[var(--muted)]">
              {form.ownerId
                ? `المختار: ${selectedOwner?.name || ""}`
                : `اضغط لاختيار شخص من القائمة (${users.length})`}
            </p>
          ) : null}
        </div>
        <div className="field">
          <label>
            {isExternalOwner
              ? "التصنيف"
              : `القسم${deptRequired ? "" : " (اختياري للتنفيذي / الموارد البشرية)"}`}
          </label>
          {isExternalOwner ? (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--brand-soft)] px-3 py-2.5 text-sm font-semibold text-[var(--brand)]">
              عقد خارجي
            </div>
          ) : (
            <select
              required={deptRequired}
              value={form.departmentId}
              onChange={(e) =>
                setForm({ ...form, departmentId: e.target.value })
              }
              disabled={isManager && availableDepartments.length <= 1}
            >
              <option value="">
                {ownerNeedsNoDept ? "بدون قسم / اختياري" : "اختر..."}
              </option>
              {availableDepartments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="field">
          <label>الأولوية</label>
          <select
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
          >
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>الحالة</label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>تاريخ التكليف</label>
          <input
            type="date"
            value={form.assignedDate}
            onChange={(e) => setForm({ ...form, assignedDate: e.target.value })}
          />
        </div>
        <div className="field">
          <label>تاريخ الاستحقاق</label>
          <input
            type="date"
            value={form.targetDate}
            onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
          />
        </div>
        <div className="field md:col-span-2">
          <label>القرار / الأمر</label>
          <textarea
            rows={4}
            value={form.managementDecision}
            onChange={(e) =>
              setForm({
                ...form,
                managementDecision: e.target.value,
                nextAction: e.target.value,
              })
            }
            placeholder="اكتب القرار أو الأمر المطلوب تنفيذه..."
            required
          />
        </div>
        {error ? (
          <p className="md:col-span-2 text-sm text-[var(--danger)]">{error}</p>
        ) : null}
        <div className="md:col-span-2 flex gap-2">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || listLoading || !form.ownerId}
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
