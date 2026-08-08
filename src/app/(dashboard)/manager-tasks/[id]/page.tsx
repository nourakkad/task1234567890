"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/PageHeader";
import { PriorityBadge, StatusBadge } from "@/components/StatusBadge";
import { TimelineList } from "@/components/tasks/TimelineList";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { apiGet, apiSend } from "@/lib/client";
import { formatDate, formatPercent } from "@/lib/format";

interface TaskDetail {
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
  managementDecision?: string;
  lastUpdate?: string;
  ownerId?: { name: string };
  departmentId?: { name: string };
  assignedById?: { name: string; role?: string };
}

interface UpdateRow {
  _id: string;
  updateNo: string;
  date: string;
  createdAt?: string;
  workPerformed: string;
  result?: string;
  nextAction?: string;
  entryType?: "update" | "ceo_order" | "ceo_decision";
  createdBy?: { name: string; role?: string };
}

type ManagerAction =
  | "start"
  | "wait_supplier"
  | "request_decision"
  | "pause"
  | "ready_to_close";

const ACTION_META: Record<
  ManagerAction,
  { label: string; status: string; result: string }
> = {
  start: {
    label: "بدء التنفيذ",
    status: "قيد التنفيذ",
    result: "تم بدء العمل على المهمة",
  },
  wait_supplier: {
    label: "بانتظار المورد",
    status: "بانتظار المورد",
    result: "المهمة بانتظار رد/توريد من المورد",
  },
  request_decision: {
    label: "طلب قرار من المدير التنفيذي",
    status: "بانتظار قرار الإدارة",
    result: "تم طلب قرار من المدير التنفيذي",
  },
  pause: {
    label: "تعليق المهمة",
    status: "معلقة",
    result: "تم تعليق المهمة مؤقتًا",
  },
  ready_to_close: {
    label: "جاهزة للإنهاء",
    status: "بانتظار قرار الإدارة",
    result: "المهمة جاهزة للإنهاء بانتظار اعتماد المدير التنفيذي",
  },
};

export default function ManagerTaskDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [updates, setUpdates] = useState<UpdateRow[]>([]);
  const [updateText, setUpdateText] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const t = await apiGet<TaskDetail>(`/api/tasks/${params.id}`);
    setTask(t);
    try {
      const u = await apiGet<UpdateRow[]>(`/api/updates?taskId=${params.id}`);
      setUpdates(u);
    } catch {
      setUpdates([]);
    }
  }, [params.id]);

  useAutoRefresh(() => load().catch(() => undefined), {
    enabled: authStatus === "authenticated" && session?.user?.role === "manager",
  });

  useEffect(() => {
    if (authStatus === "loading") return;
    if (!session) {
      router.replace("/login");
      return;
    }
    if (session.user?.role !== "manager") {
      setError("هذه الصفحة للمدراء فقط");
      return;
    }
    setError("");
    load().catch((e) => setError(e.message));
  }, [authStatus, session, params.id, router, load]);

  const closed = task?.status === "مكتملة" || task?.status === "ملغاة";

  async function postUpdate(opts?: {
    status?: string;
    result?: string;
    keepText?: boolean;
  }) {
    if (!task) return;
    const text = updateText.trim();
    if (!text) {
      setError("اكتب التحديث في المربع أولاً");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    try {
      await apiSend("/api/updates", "POST", {
        taskId: task._id,
        workPerformed: text,
        result: opts?.result || "",
        nextAction: task.nextAction || "",
        status: opts?.status,
        date: new Date().toISOString().slice(0, 10),
      });
      if (!opts?.keepText) setUpdateText("");
      setMessage("تم حفظ التحديث");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل حفظ التحديث");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveUpdate(e: FormEvent) {
    e.preventDefault();
    await postUpdate();
  }

  async function onAction(action: ManagerAction) {
    if (!task || closed) return;
    const meta = ACTION_META[action];
    if (!updateText.trim()) {
      setError(`اكتب تحديثًا قبل الضغط على «${meta.label}»`);
      return;
    }
    await postUpdate({ status: meta.status, result: meta.result });
    setMessage(`تم: ${meta.label}`);
  }

  if (authStatus === "loading" || !task) {
    return (
      <p className={error ? "text-[var(--danger)]" : "text-[var(--muted)]"}>
        {error || "جارٍ التحميل..."}
      </p>
    );
  }

  const availableActions: ManagerAction[] = closed
    ? []
    : task.status === "بانتظار قرار الإدارة"
      ? ["start", "pause"]
      : task.status === "لم تبدأ"
        ? ["start", "wait_supplier", "request_decision", "pause"]
        : [
            "wait_supplier",
            "request_decision",
            "pause",
            "ready_to_close",
          ];

  return (
    <div>
      <PageHeader
        title={`${task.taskNo} — ${task.name}`}
        subtitle="مهمة مُسندة من المدير التنفيذي — أضف تحديثك ونفّذ المطلوب"
        actions={
          <Link href="/manager-tasks" className="btn btn-secondary">
            العودة لمهام الإدارة
          </Link>
        }
      />

      <div className="mx-auto grid max-w-3xl gap-4">
        <article className="card p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-[var(--brand)]">
                {task.taskNo}
              </div>
              <h2 className="mt-1 text-2xl font-bold">{task.name}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                من: {task.assignedById?.name || "المدير التنفيذي"} ·{" "}
                {task.departmentId?.name || "—"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={task.status} />
              <PriorityBadge priority={task.priority} />
            </div>
          </div>

          {task.description ? (
            <p className="mb-4 text-[var(--muted)]">{task.description}</p>
          ) : null}

          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <Detail label="تاريخ التكليف" value={formatDate(task.assignedDate)} />
            <Detail label="تاريخ الاستحقاق" value={formatDate(task.targetDate)} />
            <Detail label="آخر تحديث" value={formatDate(task.lastUpdate)} />
            <Detail label="الإنجاز" value={formatPercent(task.progress)} />
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
            <div className="text-xs font-semibold text-amber-800">
              قرار / أمر المدير التنفيذي
            </div>
            <p className="mt-2 text-sm font-medium text-[var(--ink)]">
              {task.managementDecision ||
                task.nextAction ||
                "لا يوجد قرار أو أمر مسجّل بعد"}
            </p>
          </div>
        </article>

        <article className="card space-y-4 p-6">
          <div>
            <h3 className="text-lg font-semibold">تحديث المدير</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              اكتب ما تم إنجازه، ثم احفظ التحديث أو اختر الإجراء المطلوب
            </p>
          </div>

          <form onSubmit={onSaveUpdate} className="space-y-3">
            <div className="field">
              <label>مربع التحديث</label>
              <textarea
                rows={5}
                value={updateText}
                onChange={(e) => setUpdateText(e.target.value)}
                placeholder="مثال: تم التواصل مع الموردين وجمع العروض..."
                disabled={closed || busy}
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-secondary"
              disabled={closed || busy || !updateText.trim()}
            >
              حفظ التحديث فقط
            </button>
          </form>

          {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
          {message ? <p className="text-sm text-[var(--ok)]">{message}</p> : null}

          {closed ? (
            <p className="rounded-xl bg-[var(--brand-soft)] px-3 py-2 text-sm">
              المهمة مغلقة ({task.status})
            </p>
          ) : (
            <div className="space-y-2 border-t border-[var(--line)] pt-4">
              <div className="text-sm font-semibold">إجراءات حسب المطلوب</div>
              <div className="flex flex-wrap gap-2">
                {availableActions.map((action) => (
                  <button
                    key={action}
                    type="button"
                    className={`btn ${
                      action === "request_decision" ||
                      action === "ready_to_close"
                        ? "btn-primary"
                        : action === "pause"
                          ? "btn-danger"
                          : "btn-secondary"
                    }`}
                    disabled={busy}
                    onClick={() => onAction(action)}
                  >
                    {ACTION_META[action].label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </article>

        <article className="card p-6">
          <h3 className="mb-3 text-lg font-semibold">سجل التحديثات</h3>
          <p className="mb-3 text-xs text-[var(--muted)]">
            الأحدث أولاً — يشمل تحديثات المدير وأوامر/قرارات المدير التنفيذي
          </p>
          <TimelineList items={updates} />
        </article>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 font-medium">{value || "—"}</dd>
    </div>
  );
}
