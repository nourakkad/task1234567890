"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
  managementDecision?: string;
  lastUpdate?: string;
  performanceScore?: number | null;
  ownerId?: { name: string; role?: string };
  departmentId?: { name: string };
}

interface UpdateRow {
  _id: string;
  updateNo: string;
  date: string;
  createdAt?: string;
  workPerformed: string;
  result?: string;
  entryType?:
    | "update"
    | "ceo_order"
    | "ceo_decision"
    | "manager_order"
    | "manager_decision";
  createdBy?: { name: string; role?: string };
}

type Decision = "approved" | "rejected" | "ended" | "note";

export default function TeamTaskDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [updates, setUpdates] = useState<UpdateRow[]>([]);
  const [order, setOrder] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    const [t, u] = await Promise.all([
      apiGet<TaskDetail>(`/api/tasks/${params.id}`),
      apiGet<UpdateRow[]>(`/api/updates?taskId=${params.id}`).catch(() => []),
    ]);
    setTask(t);
    setOrder(t.nextAction || "");
    if (t.performanceScore != null) setScore(t.performanceScore);
    setUpdates(u);
  }, [params.id]);

  useEffect(() => {
    if (authStatus === "loading") return;
    if (session?.user?.role !== "manager") {
      setError("هذه الصفحة للمدراء فقط");
      return;
    }
    load().catch((e) => setError(e.message));
  }, [authStatus, session?.user?.role, load]);

  useAutoRefresh(() => load().catch(() => undefined), {
    enabled: authStatus === "authenticated" && session?.user?.role === "manager",
  });

  const closed = task?.status === "مكتملة" || task?.status === "ملغاة";
  const needsRating = !closed;

  const actions = useMemo(() => {
    if (!task || closed) return { accept: false, reject: false, end: false };
    if (task.status === "بانتظار قرار الإدارة") {
      return { accept: true, reject: true, end: true };
    }
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
      await apiSend(`/api/tasks/${task._id}/approve`, "POST", {
        decision,
        notes: order,
        ...(decision === "ended" && needsRating
          ? { performanceScore: score }
          : {}),
      });
      if (decision === "note") setMessage("تم حفظ القرار / الأمر");
      if (decision === "approved") setMessage("تم قبول المهمة");
      if (decision === "rejected") setMessage("تم رفض المهمة");
      if (decision === "ended") setMessage("تم إنهاء المهمة");
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
    if (!task || deleting) return;

    setDeleting(true);
    setError("");
    setMessage("");
    try {
      await apiSend(`/api/tasks/${task._id}`, "DELETE");
      router.replace("/team-tasks");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل حذف المهمة");
      setDeleting(false);
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
        subtitle={`متابعة مهمة الموظف: ${task.ownerId?.name || "—"}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-danger"
              disabled={busy || deleting}
              onClick={() => setConfirmDelete(true)}
            >
              حذف المهمة
            </button>
            <Link href="/team-tasks" className="btn btn-secondary">
              العودة لمتابعة الفريق
            </Link>
          </div>
        }
      />

      <ConfirmDialog
        open={confirmDelete}
        title="تأكيد حذف المهمة"
        message={deleteTaskConfirmMessage(task.taskNo, task.name)}
        busy={deleting}
        onCancel={() => {
          if (!deleting) setConfirmDelete(false);
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
            <p className="mb-4 text-[var(--muted)]">{task.description}</p>
          ) : null}
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <Detail label="الموظف" value={task.ownerId?.name} />
            <Detail label="القسم" value={task.departmentId?.name} />
            <Detail label="تاريخ التكليف" value={formatDate(task.assignedDate)} />
            <Detail label="الاستحقاق" value={formatDate(task.targetDate)} />
            <Detail label="آخر تحديث" value={formatDate(task.lastUpdate)} />
            <Detail label="الإنجاز" value={formatPercent(task.progress)} />
            {task.performanceScore != null ? (
              <Detail
                label="تقييم الأداء"
                value={`${task.performanceScore}/10`}
              />
            ) : null}
          </div>
          <div className="rounded-xl border border-[var(--accent)]/40 bg-[var(--accent-soft)] p-4">
            <div className="text-xs font-semibold text-[var(--brand-deep)]">
              أمرك الحالي للموظف
            </div>
            <p className="mt-2 text-sm font-medium">
              {task.nextAction || "لا يوجد أمر مسجّل"}
            </p>
          </div>
        </article>

        <article className="card space-y-4 p-6">
          <div>
            <h3 className="text-lg font-semibold">قرار / أمر المدير</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              اكتب الأمر للموظف، ثم اقبل أو ارفض أو أنهِ المهمة حسب الحالة
            </p>
          </div>
          <form onSubmit={onSaveOrder} className="space-y-3">
            <div className="field">
              <label>القرار / الأمر</label>
              <textarea
                rows={4}
                value={order}
                onChange={(e) => setOrder(e.target.value)}
                placeholder="اكتب القرار أو الأمر المطلوب من الموظف..."
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
              label="تقييم أداء الموظف (من 1 إلى 10)"
            />
          ) : null}

          {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
          {message ? <p className="text-sm text-[var(--ok)]">{message}</p> : null}
          {!closed ? (
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
                  style={{ background: "var(--ok)" }}
                  disabled={busy || (needsRating && score == null)}
                  onClick={() => submitDecision("ended")}
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
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              المهمة مغلقة ({task.status})
            </p>
          )}
        </article>

        <article className="card p-6">
          <h3 className="mb-3 text-lg font-semibold">سجل التحديثات</h3>
          <p className="mb-3 text-xs text-[var(--muted)]">
            الأحدث أولاً — تحديثات الموظف وأوامر/قرارات المدير
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
