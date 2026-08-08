import Link from "next/link";
import { PriorityBadge, StatusBadge } from "@/components/StatusBadge";
import { formatDate, formatPercent } from "@/lib/format";

export interface TaskLastMessage {
  text: string;
  date?: string | Date | null;
  entryType?: string;
  senderName: string;
  senderRole?: string;
  senderRoleLabel: string;
}

export interface TaskCardData {
  _id: string;
  taskNo: string;
  name: string;
  description?: string;
  status: string;
  priority: string;
  progress: number;
  lastUpdate?: string | null;
  nextAction?: string;
  nextActionDate?: string | null;
  targetDate?: string | null;
  assignedDate?: string;
  managementDecision?: string;
  managerApproval?: string;
  ownerId?: { _id?: string; name?: string; role?: string } | null;
  departmentId?: { _id?: string; name?: string } | null;
  lastMessage?: TaskLastMessage | null;
}

const APPROVAL_LABEL: Record<string, string> = {
  pending: "بانتظار الاعتماد",
  approved: "معتمدة",
  rejected: "مرفوضة",
};

function messageStyle(role?: string, entryType?: string) {
  if (
    role === "ceo" ||
    entryType === "ceo_order" ||
    entryType === "ceo_decision"
  ) {
    return "msg-ceo border";
  }
  if (
    role === "manager" ||
    entryType === "manager_order" ||
    entryType === "manager_decision"
  ) {
    return "msg-manager border";
  }
  return "msg-employee border";
}

export function TaskCard({
  task,
  href,
}: {
  task: TaskCardData;
  href?: string;
}) {
  const link = href ?? `/tasks/${task._id}`;
  const last = task.lastMessage;

  return (
    <Link
      href={link}
      className="card group block p-5 transition hover:border-[var(--brand)] hover:shadow-md"
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold tracking-wide text-[var(--brand)]">
            {task.taskNo}
          </div>
          <h3 className="mt-1 text-lg font-bold leading-snug group-hover:text-[var(--brand)]">
            {task.name}
          </h3>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <StatusBadge status={task.status} />
          <PriorityBadge priority={task.priority} />
        </div>
      </div>

      {task.description ? (
        <p className="mb-4 line-clamp-2 text-sm text-[var(--muted)]">
          {task.description}
        </p>
      ) : null}

      <div className="mb-4">
        <div className="mb-1 flex items-center justify-between text-xs text-[var(--muted)]">
          <span>نسبة الإنجاز</span>
          <span className="font-semibold text-[var(--ink)]">
            {formatPercent(task.progress)}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--line)]">
          <div
            className="h-full rounded-full bg-[var(--brand)] transition-all"
            style={{
              width: `${Math.min(100, Math.max(0, (task.progress || 0) * 100))}%`,
            }}
          />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <div>
          <dt className="text-xs text-[var(--muted)]">المسؤول الحالي</dt>
          <dd className="font-medium">{task.ownerId?.name || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--muted)]">القسم</dt>
          <dd className="font-medium">{task.departmentId?.name || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--muted)]">تاريخ الاستحقاق</dt>
          <dd>{formatDate(task.targetDate)}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--muted)]">آخر تحديث</dt>
          <dd>{formatDate(task.lastUpdate)}</dd>
        </div>
        {task.managerApproval ? (
          <div className="col-span-2">
            <dt className="text-xs text-[var(--muted)]">اعتماد المدير</dt>
            <dd>
              {APPROVAL_LABEL[task.managerApproval] || task.managerApproval}
            </dd>
          </div>
        ) : null}
      </dl>

      <div
        className={`mt-4 rounded-xl border px-3 py-2.5 ${messageStyle(
          last?.senderRole,
          last?.entryType
        )}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--muted)]">
          <span className="font-semibold">
            آخر رسالة
            {last
              ? ` · ${last.senderRoleLabel}${
                  last.senderName ? ` — ${last.senderName}` : ""
                }`
              : ""}
          </span>
          {last?.date ? (
            <span>{formatDate(last.date)}</span>
          ) : null}
        </div>
        <p className="mt-1 line-clamp-3 text-sm font-medium text-[var(--ink)]">
          {last?.text || "لا توجد رسائل بعد"}
        </p>
      </div>
    </Link>
  );
}
