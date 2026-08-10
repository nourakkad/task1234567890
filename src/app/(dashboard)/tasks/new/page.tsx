"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/PageHeader";
import { ROLE_LABELS, TASK_PRIORITIES, TASK_STATUSES } from "@/constants/lookups";
import { apiGet, apiSend } from "@/lib/client";

interface AssignableUser {
  _id: string;
  name: string;
  role: string;
  departmentId?: { _id: string; name: string } | string;
}

interface Department {
  _id: string;
  name: string;
}

export default function NewTaskPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const isGm = role === "general_manager";
  const isCeo = role === "ceo";
  const isManager = role === "manager";
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
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
  const ownerIsCeo = selectedOwner?.role === "ceo";
  const deptRequired = !ownerIsCeo;

  useEffect(() => {
    Promise.all([
      apiGet<AssignableUser[]>("/api/users/assignable"),
      apiGet<Department[]>("/api/departments"),
    ])
      .then(([u, d]) => {
        setUsers(u);
        setDepartments(d);
        if (isManager && session?.user?.departmentId) {
          setForm((f) => ({
            ...f,
            departmentId: session.user.departmentId || "",
          }));
        }
      })
      .catch((e) => setError(e.message));
  }, [isManager, session?.user?.departmentId]);

  function onOwnerChange(ownerId: string) {
    const owner = users.find((u) => u._id === ownerId);
    let departmentId = "";
    if (owner?.departmentId) {
      departmentId =
        typeof owner.departmentId === "string"
          ? owner.departmentId
          : owner.departmentId._id;
    }
    setForm((f) => ({ ...f, ownerId, departmentId }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
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
    ? "تكليف المدير التنفيذي أو مدير"
    : isCeo
      ? "تكليف مدير بمهمة"
      : "تكليف موظف بمهمة";

  const subtitle = isGm
    ? "المدير العام يسند المهام للمدير التنفيذي والمدراء"
    : isCeo
      ? "المدير التنفيذي يسند المهام للمدراء فقط"
      : "المدير يسند المهام لموظفي فريقه مع قرار/أمر واضح";

  const ownerLabel = isGm
    ? "المسؤول (تنفيذي / مدير)"
    : isCeo
      ? "المدير المسؤول"
      : "الموظف المسؤول";

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
        <div className="field">
          <label>{ownerLabel}</label>
          <select
            required
            value={form.ownerId}
            onChange={(e) => onOwnerChange(e.target.value)}
          >
            <option value="">اختر...</option>
            {users.map((u) => (
              <option key={u._id} value={u._id}>
                {u.name}
                {ROLE_LABELS[u.role as keyof typeof ROLE_LABELS]
                  ? ` — ${ROLE_LABELS[u.role as keyof typeof ROLE_LABELS]}`
                  : ""}
                {typeof u.departmentId === "object" && u.departmentId?.name
                  ? ` (${u.departmentId.name})`
                  : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>القسم{deptRequired ? "" : " (اختياري للتنفيذي)"}</label>
          <select
            required={deptRequired}
            value={form.departmentId}
            onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
            disabled={isManager}
          >
            <option value="">
              {ownerIsCeo ? "بدون قسم / اختياري" : "اختر..."}
            </option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>
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
          <button type="submit" className="btn btn-primary" disabled={loading}>
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
