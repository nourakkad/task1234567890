"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/PageHeader";
import { PriorityBadge, StatusBadge } from "@/components/StatusBadge";
import {
  DOCUMENT_TYPES,
  SAMPLE_STATUSES,
  SUPPLIER_DECISIONS,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@/constants/lookups";
import { apiGet, apiSend } from "@/lib/client";
import { formatDate, formatPercent, toInputDate } from "@/lib/format";

type Tab = "details" | "updates" | "suppliers" | "documents" | "approval";

interface Task {
  _id: string;
  taskNo: string;
  name: string;
  description?: string;
  status: string;
  priority: string;
  progress: number;
  assignedDate: string;
  targetDate?: string;
  nextAction?: string;
  nextActionDate?: string;
  managementDecision?: string;
  folderLink?: string;
  managerApproval: string;
  closureDate?: string;
  lastUpdate?: string;
  ownerId?: { _id: string; name: string };
  departmentId?: { _id: string; name: string };
}

interface Update {
  _id: string;
  updateNo: string;
  date: string;
  workPerformed: string;
  supplier?: string;
  result?: string;
  issue?: string;
  nextAction?: string;
  expectedDate?: string;
  hours?: number;
  managerNotes?: string;
  createdBy?: { name: string };
}

interface Supplier {
  _id: string;
  name: string;
  product?: string;
  currency?: string;
  sampleStatus?: string;
  rating?: number;
  decision?: string;
  reason?: string;
}

interface Doc {
  _id: string;
  recordNo: string;
  supplier?: string;
  recordType: string;
  name: string;
  status?: string;
  reviewResult?: string;
  requestDate?: string;
  expectedDate?: string;
  actualDate?: string;
}

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const [tab, setTab] = useState<Tab>("details");
  const [task, setTask] = useState<Task | null>(null);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deleting, setDeleting] = useState(false);

  const role = session?.user?.role;
  const canApprove =
    role === "general_manager" || role === "ceo" || role === "manager";
  const canDelete = role === "ceo";

  const load = useCallback(async () => {
    const id = params.id;
    const [t, u, s, d] = await Promise.all([
      apiGet<Task>(`/api/tasks/${id}`),
      apiGet<Update[]>(`/api/updates?taskId=${id}`),
      apiGet<Supplier[]>(`/api/suppliers?taskId=${id}`),
      apiGet<Doc[]>(`/api/documents?taskId=${id}`),
    ]);
    setTask(t);
    setUpdates(u);
    setSuppliers(s);
    setDocs(d);
  }, [params.id]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  async function saveDetails(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!task) return;
    setError("");
    setMessage("");
    try {
      const form = new FormData(e.currentTarget);
      const updated = await apiSend<Task>(`/api/tasks/${task._id}`, "PATCH", {
        name: form.get("name"),
        description: form.get("description"),
        status: form.get("status"),
        priority: form.get("priority"),
        progress: Number(form.get("progress")) / 100,
        targetDate: form.get("targetDate") || null,
        nextAction: form.get("nextAction"),
        nextActionDate: form.get("nextActionDate") || null,
        managementDecision: form.get("managementDecision"),
        folderLink: form.get("folderLink"),
      });
      setTask(updated);
      setMessage("تم حفظ التعديلات");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الحفظ");
    }
  }

  async function addUpdate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!task) return;
    const form = new FormData(e.currentTarget);
    try {
      await apiSend("/api/updates", "POST", {
        taskId: task._id,
        date: form.get("date"),
        workPerformed: form.get("workPerformed"),
        supplier: form.get("supplier"),
        result: form.get("result"),
        issue: form.get("issue"),
        nextAction: form.get("nextAction"),
        expectedDate: form.get("expectedDate") || null,
        hours: Number(form.get("hours") || 0),
        status: form.get("status") || undefined,
        progress:
          form.get("progress") !== ""
            ? Number(form.get("progress")) / 100
            : undefined,
      });
      e.currentTarget.reset();
      await load();
      setMessage("تم إضافة التحديث");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الإضافة");
    }
  }

  async function addSupplier(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!task) return;
    const form = new FormData(e.currentTarget);
    try {
      await apiSend("/api/suppliers", "POST", {
        taskId: task._id,
        name: form.get("name"),
        product: form.get("product"),
        currency: form.get("currency"),
        sampleStatus: form.get("sampleStatus"),
        rating: form.get("rating") ? Number(form.get("rating")) : null,
        decision: form.get("decision"),
        reason: form.get("reason"),
      });
      e.currentTarget.reset();
      await load();
      setMessage("تم إضافة المورد");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الإضافة");
    }
  }

  async function addDoc(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!task) return;
    const form = new FormData(e.currentTarget);
    try {
      await apiSend("/api/documents", "POST", {
        taskId: task._id,
        name: form.get("name"),
        recordType: form.get("recordType"),
        supplier: form.get("supplier"),
        status: form.get("status"),
        reviewResult: form.get("reviewResult"),
        requestDate: form.get("requestDate") || null,
        expectedDate: form.get("expectedDate") || null,
        actualDate: form.get("actualDate") || null,
        fileLink: form.get("fileLink"),
      });
      e.currentTarget.reset();
      await load();
      setMessage("تم إضافة السجل");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الإضافة");
    }
  }

  async function approve(decision: "approved" | "rejected") {
    if (!task) return;
    try {
      const form = document.getElementById("approval-form") as HTMLFormElement;
      const data = new FormData(form);
      await apiSend(`/api/tasks/${task._id}/approve`, "POST", {
        decision,
        close: data.get("close") === "on",
        managementDecision: data.get("managementDecision"),
        notes: data.get("notes"),
      });
      await load();
      setMessage(decision === "approved" ? "تم اعتماد المهمة" : "تم رفض الاعتماد");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الاعتماد");
    }
  }

  async function onDeleteTask() {
    if (!task || !canDelete) return;
    const ok = window.confirm(
      `هل تريد حذف المهمة «${task.taskNo} — ${task.name}»؟\nسيتم حذف التحديثات والموردين والمستندات المرتبطة بها نهائيًا.`
    );
    if (!ok) return;

    setDeleting(true);
    setError("");
    setMessage("");
    try {
      await apiSend(`/api/tasks/${task._id}`, "DELETE");
      router.replace("/track");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل حذف المهمة");
      setDeleting(false);
    }
  }

  if (!task && !error) {
    return <p className="text-[var(--muted)]">جارٍ التحميل...</p>;
  }
  if (!task) return <p className="text-[var(--danger)]">{error}</p>;

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "details", label: "التفاصيل" },
    { id: "updates", label: "التحديث اليومي" },
    { id: "suppliers", label: "الموردون" },
    { id: "documents", label: "العينات والمستندات" },
    { id: "approval", label: "الاعتماد والقرار" },
  ];

  return (
    <div>
      <PageHeader
        title={`${task.taskNo} — ${task.name}`}
        subtitle={`${task.departmentId?.name || ""} · ${task.ownerId?.name || ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            <span className="badge badge-slate">
              إنجاز {formatPercent(task.progress)}
            </span>
            {canDelete ? (
              <button
                type="button"
                className="btn btn-danger"
                disabled={deleting}
                onClick={onDeleteTask}
              >
                {deleting ? "جارٍ الحذف..." : "حذف المهمة"}
              </button>
            ) : null}
          </div>
        }
      />

      {error ? <p className="mb-3 text-[var(--danger)]">{error}</p> : null}
      {message ? <p className="mb-3 text-[var(--ok)]">{message}</p> : null}

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`btn ${tab === t.id ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "details" ? (
        <form onSubmit={saveDetails} className="card grid gap-4 p-5 md:grid-cols-2">
          <div className="field md:col-span-2">
            <label>اسم المهمة</label>
            <input name="name" defaultValue={task.name} required />
          </div>
          <div className="field md:col-span-2">
            <label>الوصف</label>
            <textarea
              name="description"
              rows={3}
              defaultValue={task.description || ""}
            />
          </div>
          <div className="field">
            <label>الحالة</label>
            <select name="status" defaultValue={task.status}>
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>الأولوية</label>
            <select name="priority" defaultValue={task.priority}>
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>نسبة الإنجاز %</label>
            <input
              name="progress"
              type="number"
              min={0}
              max={100}
              defaultValue={Math.round((task.progress || 0) * 100)}
            />
          </div>
          <div className="field">
            <label>تاريخ الاستحقاق</label>
            <input
              name="targetDate"
              type="date"
              defaultValue={toInputDate(task.targetDate)}
            />
          </div>
          <div className="field">
            <label>الإجراء التالي</label>
            <input name="nextAction" defaultValue={task.nextAction || ""} />
          </div>
          <div className="field">
            <label>تاريخ الإجراء التالي</label>
            <input
              name="nextActionDate"
              type="date"
              defaultValue={toInputDate(task.nextActionDate)}
            />
          </div>
          <div className="field md:col-span-2">
            <label>قرار مطلوب من الإدارة</label>
            <input
              name="managementDecision"
              defaultValue={task.managementDecision || ""}
            />
          </div>
          <div className="field md:col-span-2">
            <label>رابط مجلد المهمة</label>
            <input name="folderLink" defaultValue={task.folderLink || ""} />
          </div>
          <div className="md:col-span-2 text-sm text-[var(--muted)]">
            تاريخ التكليف: {formatDate(task.assignedDate)} · آخر تحديث:{" "}
            {formatDate(task.lastUpdate)} · اعتماد المدير:{" "}
            {task.managerApproval}
            {task.closureDate
              ? ` · تاريخ الإغلاق: ${formatDate(task.closureDate)}`
              : ""}
          </div>
          <div className="md:col-span-2">
            <button type="submit" className="btn btn-primary">
              حفظ التفاصيل
            </button>
          </div>
        </form>
      ) : null}

      {tab === "updates" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="card table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>رقم</th>
                  <th>التاريخ</th>
                  <th>العمل المنفذ</th>
                  <th>النتيجة</th>
                  <th>ساعات</th>
                  <th>ملاحظات المدير</th>
                </tr>
              </thead>
              <tbody>
                {updates.map((u) => (
                  <tr key={u._id}>
                    <td>{u.updateNo}</td>
                    <td>{formatDate(u.date)}</td>
                    <td className="whitespace-normal!">{u.workPerformed}</td>
                    <td className="whitespace-normal!">{u.result || "—"}</td>
                    <td>{u.hours ?? 0}</td>
                    <td className="whitespace-normal!">
                      {u.managerNotes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form onSubmit={addUpdate} className="card space-y-3 p-4">
            <h3 className="font-semibold">تحديث يومي جديد</h3>
            <div className="field">
              <label>التاريخ</label>
              <input
                name="date"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
              />
            </div>
            <div className="field">
              <label>العمل المنفذ</label>
              <textarea name="workPerformed" rows={3} required />
            </div>
            <div className="field">
              <label>المورد/الجهة</label>
              <input name="supplier" />
            </div>
            <div className="field">
              <label>النتيجة</label>
              <input name="result" />
            </div>
            <div className="field">
              <label>المشكلة أو سبب التأخير</label>
              <input name="issue" />
            </div>
            <div className="field">
              <label>الإجراء التالي</label>
              <input name="nextAction" />
            </div>
            <div className="field">
              <label>التاريخ المتوقع</label>
              <input name="expectedDate" type="date" />
            </div>
            <div className="field">
              <label>ساعات العمل</label>
              <input name="hours" type="number" min={0} step={0.5} defaultValue={0} />
            </div>
            <div className="field">
              <label>تحديث حالة المهمة (اختياري)</label>
              <select name="status" defaultValue="">
                <option value="">بدون تغيير</option>
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>تحديث الإنجاز % (اختياري)</label>
              <input name="progress" type="number" min={0} max={100} />
            </div>
            <button type="submit" className="btn btn-primary w-full">
              إضافة التحديث
            </button>
          </form>
        </div>
      ) : null}

      {tab === "suppliers" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="card table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>المورد</th>
                  <th>المنتج</th>
                  <th>العملة</th>
                  <th>حالة العينة</th>
                  <th>التقييم</th>
                  <th>القرار</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s._id}>
                    <td>{s.name}</td>
                    <td className="whitespace-normal!">{s.product || "—"}</td>
                    <td>{s.currency || "—"}</td>
                    <td>{s.sampleStatus || "—"}</td>
                    <td>{s.rating ?? "—"}</td>
                    <td>{s.decision || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form onSubmit={addSupplier} className="card space-y-3 p-4">
            <h3 className="font-semibold">إضافة مورد</h3>
            <div className="field">
              <label>اسم المورد</label>
              <input name="name" required />
            </div>
            <div className="field">
              <label>المنتج/المادة</label>
              <input name="product" />
            </div>
            <div className="field">
              <label>العملة</label>
              <input name="currency" defaultValue="RMB" />
            </div>
            <div className="field">
              <label>حالة العينة</label>
              <select name="sampleStatus" defaultValue="لم تطلب">
                {SAMPLE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>التقييم /10</label>
              <input name="rating" type="number" min={0} max={10} />
            </div>
            <div className="field">
              <label>القرار</label>
              <select name="decision" defaultValue="قيد التقييم">
                {SUPPLIER_DECISIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>سبب القبول أو الاستبعاد</label>
              <input name="reason" />
            </div>
            <button type="submit" className="btn btn-primary w-full">
              حفظ المورد
            </button>
          </form>
        </div>
      ) : null}

      {tab === "documents" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="card table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>رقم السجل</th>
                  <th>النوع</th>
                  <th>الاسم</th>
                  <th>المورد</th>
                  <th>الحالة</th>
                  <th>نتيجة الفحص</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d._id}>
                    <td>{d.recordNo}</td>
                    <td>{d.recordType}</td>
                    <td className="whitespace-normal!">{d.name}</td>
                    <td>{d.supplier || "—"}</td>
                    <td>{d.status || "—"}</td>
                    <td>{d.reviewResult || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form onSubmit={addDoc} className="card space-y-3 p-4">
            <h3 className="font-semibold">إضافة عينة/مستند</h3>
            <div className="field">
              <label>نوع السجل</label>
              <select name="recordType" required defaultValue="ورقة مواصفات فنية">
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>اسم المستند/العينة</label>
              <input name="name" required />
            </div>
            <div className="field">
              <label>المورد</label>
              <input name="supplier" />
            </div>
            <div className="field">
              <label>الحالة</label>
              <input name="status" />
            </div>
            <div className="field">
              <label>نتيجة الفحص/المراجعة</label>
              <input name="reviewResult" />
            </div>
            <div className="field">
              <label>تاريخ الطلب</label>
              <input name="requestDate" type="date" />
            </div>
            <div className="field">
              <label>تاريخ الاستلام المتوقع</label>
              <input name="expectedDate" type="date" />
            </div>
            <div className="field">
              <label>تاريخ الاستلام الفعلي</label>
              <input name="actualDate" type="date" />
            </div>
            <div className="field">
              <label>رابط الملف</label>
              <input name="fileLink" />
            </div>
            <button type="submit" className="btn btn-primary w-full">
              حفظ السجل
            </button>
          </form>
        </div>
      ) : null}

      {tab === "approval" ? (
        <div className="card max-w-2xl space-y-4 p-5">
          <div className="text-sm text-[var(--muted)]">
            اعتماد المدير الحالي:{" "}
            <strong className="text-[var(--ink)]">{task.managerApproval}</strong>
          </div>
          <div className="rounded-xl bg-[var(--brand-soft)] p-3 text-sm">
            لا تُغلق المهمة إلا بعد التقرير النهائي واعتماد الإدارة. عند الحالة
            «بانتظار قرار الإدارة» يُسجّل قرار المدير التنفيذي هنا.
          </div>
          <form id="approval-form" className="space-y-3">
            <div className="field">
              <label>قرار الإدارة / الملاحظات</label>
              <textarea
                name="managementDecision"
                rows={3}
                defaultValue={task.managementDecision || ""}
              />
            </div>
            <div className="field">
              <label>ملاحظة على الإجراء التالي</label>
              <input name="notes" defaultValue={task.nextAction || ""} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="close" />
              إغلاق المهمة كمكتملة عند الاعتماد
            </label>
          </form>
          {canApprove ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => approve("approved")}
              >
                اعتماد
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => approve("rejected")}
              >
                رفض
              </button>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              بانتظار اعتماد المدير أو قرار الإدارة.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
