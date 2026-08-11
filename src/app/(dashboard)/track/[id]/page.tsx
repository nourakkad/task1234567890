"use client";

import {
  FormEvent,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/PageHeader";
import {
  ConfirmDialog,
  deleteTaskConfirmMessage,
} from "@/components/ConfirmDialog";
import { PriorityBadge, StatusBadge } from "@/components/StatusBadge";
import { StarRating } from "@/components/tasks/StarRating";
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
  nextActionDate?: string;
  managementDecision?: string;
  folderLink?: string;
  managerApproval: string;
  closureDate?: string;
  lastUpdate?: string;
  performanceScore?: number | null;
  ownerId?: { name: string; email?: string; role?: string };
  departmentId?: { name: string };
  assignedById?: { name: string };
}

interface UpdateRow {
  _id: string;
  updateNo: string;
  date: string;
  createdAt?: string;
  workPerformed: string;
  result?: string;
  nextAction?: string;
  hours?: number;
  entryType?: "update" | "ceo_order" | "ceo_decision";
  createdBy?: { name: string; role?: string };
}

const APPROVAL_LABEL: Record<string, string> = {
  pending: "بانتظار الاعتماد",
  approved: "معتمدة",
  rejected: "مرفوضة",
};

type Decision = "approved" | "rejected" | "ended" | "note";

export default function TrackDetailPage() {
  return (
    <Suspense fallback={<p className="text-[var(--muted)]">جارٍ التحميل...</p>}>
      <TrackDetailInner />
    </Suspense>
  );
}

function TrackDetailInner() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const isLeadership = role === "general_manager" || role === "ceo";
  const canDelete = role === "ceo" || role === "general_manager";
  const backHref =
    searchParams.get("back") ||
    (isLeadership ? "/track" : "/manager-tasks");
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [updates, setUpdates] = useState<UpdateRow[]>([]);
  const [order, setOrder] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    const [t, u] = await Promise.all([
      apiGet<TaskDetail>(`/api/tasks/${params.id}`),
      apiGet<UpdateRow[]>(`/api/updates?taskId=${params.id}`),
    ]);
    setTask(t);
    setUpdates(u);
    if (t.performanceScore != null) setScore(t.performanceScore);
  }, [params.id]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  useAutoRefresh(() => load().catch(() => undefined), {
    enabled: Boolean(params.id),
  });

  const closed = task?.status === "مكتملة" || task?.status === "ملغاة";
  const needsRating =
    role === "ceo" && task?.ownerId?.role === "manager" && !closed;

  const actions = useMemo(() => {
    if (!task || closed) return { accept: false, reject: false, end: false };

    if (task.status === "بانتظار قرار الإدارة") {
      return { accept: true, reject: true, end: true };
    }

    // Active work: CEO can end or reject
    if (
      ["لم تبدأ", "قيد التنفيذ", "بانتظار المورد", "معلقة"].includes(
        task.status
      )
    ) {
      return { accept: false, reject: true, end: true };
    }

    return { accept: false, reject: false, end: false };
  }, [task, closed]);

  async function submitDecision(decision: Decision) {
    if (!task) return;
    if (decision === "ended" && needsRating && score == null) {
      setError("اختر تقييم الأداء من 1 إلى 10 قبل إنهاء المهمة");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const updated = await apiSend<TaskDetail>(
        `/api/tasks/${task._id}/approve`,
        "POST",
        {
          decision,
          notes: order,
          ...(decision === "ended" && needsRating
            ? { performanceScore: score }
            : {}),
        }
      );
      setTask(updated);
      if (decision === "note") {
        setOrder("");
        setMessage("تم حفظ القرار / الأمر");
      }
      if (decision === "approved") {
        setOrder("");
        setMessage("تم قبول المهمة");
      }
      if (decision === "rejected") {
        setOrder("");
        setMessage("تم رفض المهمة");
      }
      if (decision === "ended") {
        setOrder("");
        setMessage("تم إنهاء المهمة");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تنفيذ القرار");
    } finally {
      setBusy(false);
    }
  }

  function onSaveOrder(e: FormEvent) {
    e.preventDefault();
    submitDecision("note");
  }

  async function onDeleteTask() {
    if (!task || !canDelete || busy) return;

    setBusy(true);
    setError("");
    setMessage("");
    try {
      await apiSend(`/api/tasks/${task._id}`, "DELETE");
      router.replace(backHref);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل حذف المهمة");
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  if (!task) {
    return (
      <p className={error ? "text-[var(--danger)]" : "text-[var(--muted)]"}>
        {error || "جارٍ التحميل..."}
      </p>
    );
  }

  return (
    <div>
      <PageHeader
        title={`${task.taskNo} — ${task.name}`}
        subtitle={
          task.ownerId?.role === "employee"
            ? `مراجعة مهمة الموظف: ${task.ownerId?.name || "—"}`
            : "تفاصيل المهمة"
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {canDelete ? (
              <button
                type="button"
                className="btn btn-danger"
                disabled={busy}
                onClick={() => setConfirmDelete(true)}
              >
                حذف المهمة
              </button>
            ) : null}
            <Link href={backHref} className="btn btn-secondary">
              العودة
            </Link>
          </div>
        }
      />

      <ConfirmDialog
        open={confirmDelete && canDelete}
        title="تأكيد حذف المهمة"
        message={deleteTaskConfirmMessage(task.taskNo, task.name)}
        busy={busy}
        onCancel={() => {
          if (!busy) setConfirmDelete(false);
        }}
        onConfirm={onDeleteTask}
      />

      <div className="mx-auto grid max-w-3xl gap-4">
        <article className="card p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-[var(--brand)]">
                {task.taskNo}
              </div>
              <h2 className="mt-1 text-2xl font-bold">{task.name}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={task.status} />
              <PriorityBadge priority={task.priority} />
            </div>
          </div>

          {task.description ? (
            <p className="mb-5 text-[var(--muted)]">{task.description}</p>
          ) : null}

          <div className="mb-5">
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-[var(--muted)]">نسبة الإنجاز</span>
              <span className="font-semibold">
                {formatPercent(task.progress)}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[var(--line)]">
              <div
                className="h-full rounded-full bg-[var(--brand)]"
                style={{
                  width: `${Math.min(100, Math.max(0, (task.progress || 0) * 100))}%`,
                }}
              />
            </div>
          </div>

          <dl className="grid gap-4 sm:grid-cols-2">
            <Detail label="المسؤول" value={task.ownerId?.name} />
            <Detail label="القسم" value={task.departmentId?.name} />
            <Detail label="تاريخ التكليف" value={formatDate(task.assignedDate)} />
            <Detail label="تاريخ الاستحقاق" value={formatDate(task.targetDate)} />
            <Detail label="آخر تحديث" value={formatDate(task.lastUpdate)} />
            <Detail
              label="اعتماد المدير"
              value={APPROVAL_LABEL[task.managerApproval] || task.managerApproval}
            />
            <Detail
              label="الإجراء التالي"
              value={task.nextAction || "—"}
              wide
            />
            <Detail
              label="قرار / أمر الإدارة"
              value={task.managementDecision || "—"}
              wide
            />
            {task.performanceScore != null ? (
              <Detail
                label="تقييم الأداء"
                value={`${task.performanceScore}/10`}
              />
            ) : null}
            {task.closureDate ? (
              <Detail label="تاريخ الإغلاق" value={formatDate(task.closureDate)} />
            ) : null}
          </dl>
        </article>

        {isLeadership ? (
          <article className="card space-y-4 p-6">
            <div>
              <h3 className="text-lg font-semibold">
                {role === "general_manager"
                  ? "قرار / أمر المدير العام"
                  : "قرار / أمر المدير التنفيذي"}
              </h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {role === "general_manager"
                  ? "اكتب القرار أو الأمر للمدير التنفيذي أو المدير، ثم اقبل أو ارفض أو أنهِ المهمة"
                  : "اكتب القرار أو الأمر للمدير، ثم اقبل أو ارفض أو أنهِ المهمة"}
              </p>
            </div>

            <form onSubmit={onSaveOrder} className="space-y-3">
              <div className="field">
                <label>القرار / الأمر</label>
                <textarea
                  rows={4}
                  value={order}
                  onChange={(e) => setOrder(e.target.value)}
                  placeholder="اكتب القرار أو الأمر المطلوب تنفيذه..."
                  disabled={closed || busy}
                />
              </div>
              <button
                type="submit"
                className="btn btn-secondary"
                disabled={closed || busy || !order.trim()}
              >
                حفظ القرار / الأمر
              </button>
            </form>

            {needsRating || task.performanceScore != null ? (
              <StarRating
                value={task.performanceScore ?? score}
                onChange={needsRating ? setScore : undefined}
                disabled={closed || busy || !needsRating}
                label="تقييم أداء المدير (من 1 إلى 10)"
              />
            ) : null}

            {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
            {message ? <p className="text-sm text-[var(--ok)]">{message}</p> : null}

            {closed ? (
              <p className="rounded-xl bg-[var(--brand-soft)] px-3 py-2 text-sm">
                المهمة مغلقة ({task.status}) — لا يمكن اتخاذ قرار جديد
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 border-t border-[var(--line)] pt-4">
                {actions.accept ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => submitDecision("approved")}
                  >
                    قبول
                  </button>
                ) : null}
                {actions.end ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy || (needsRating && score == null)}
                    onClick={() => submitDecision("ended")}
                    style={{ background: "var(--ok)" }}
                  >
                    إنهاء المهمة
                  </button>
                ) : null}
                {actions.reject ? (
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={busy}
                    onClick={() => submitDecision("rejected")}
                  >
                    رفض
                  </button>
                ) : null}
                {!actions.accept && !actions.end && !actions.reject ? (
                  <p className="text-sm text-[var(--muted)]">
                    لا توجد إجراءات متاحة لهذه الحالة
                  </p>
                ) : null}
              </div>
            )}
          </article>
        ) : null}

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

function Detail({
  label,
  value,
  wide,
}: {
  label: string;
  value?: string | null;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 font-medium">{value || "—"}</dd>
    </div>
  );
}
