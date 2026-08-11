import { formatDate } from "@/lib/format";
import { ROLE_LABELS } from "@/constants/lookups";

export interface TimelineItem {
  _id: string;
  updateNo: string;
  date: string;
  createdAt?: string;
  workPerformed: string;
  result?: string;
  entryType?:
    | "update"
    | "gm_order"
    | "gm_decision"
    | "ceo_order"
    | "ceo_decision"
    | "manager_order"
    | "manager_decision";
  hours?: number;
  createdBy?: { name?: string; role?: string };
}

function sortNewestFirst(items: TimelineItem[]) {
  return [...items].sort((a, b) => {
    const aTime = new Date(a.createdAt || a.date).getTime();
    const bTime = new Date(b.createdAt || b.date).getTime();
    return bTime - aTime;
  });
}

function badgeFor(item: TimelineItem) {
  const role = item.createdBy?.role;
  const type = item.entryType;

  if (
    type === "gm_order" ||
    type === "gm_decision" ||
    type === "ceo_order" ||
    type === "ceo_decision" ||
    role === "general_manager" ||
    role === "ceo"
  ) {
    const isGm =
      role === "general_manager" || Boolean(type?.startsWith("gm_"));
    return {
      className: "msg-ceo border",
      badge: "badge-amber",
      label:
        type === "gm_decision" || type === "ceo_decision"
          ? isGm
            ? `قرار ${ROLE_LABELS.general_manager}`
            : `قرار ${ROLE_LABELS.ceo}`
          : type === "gm_order"
            ? `أمر / قرار ${ROLE_LABELS.general_manager}`
            : type === "ceo_order"
              ? `أمر / قرار ${ROLE_LABELS.ceo}`
              : isGm
                ? `رسالة ${ROLE_LABELS.general_manager}`
                : `رسالة ${ROLE_LABELS.ceo}`,
    };
  }

  if (
    type === "manager_order" ||
    type === "manager_decision" ||
    role === "manager"
  ) {
    return {
      className: "msg-manager border",
      badge: "badge-blue",
      label:
        type === "manager_decision"
          ? "قرار المدير"
          : type === "manager_order"
            ? "أمر / قرار المدير"
            : "رسالة المدير",
    };
  }

  if (role === "hr") {
    return {
      className: "msg-employee border",
      badge: "badge-slate",
      label: "تحديث الموارد البشرية",
    };
  }

  return {
    className: "msg-employee border",
    badge: "badge-slate",
    label: "تحديث موظف",
  };
}

export function TimelineList({ items }: { items: TimelineItem[] }) {
  const sorted = sortNewestFirst(items);

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">لا توجد تحديثات بعد</p>
    );
  }

  return (
    <ul className="space-y-3">
      {sorted.map((u) => {
        const style = badgeFor(u);
        return (
          <li
            key={u._id}
            className={`rounded-xl border p-3 ${style.className}`}
          >
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
              <span className="flex flex-wrap items-center gap-2">
                <span>
                  {u.updateNo} · {formatDate(u.createdAt || u.date)}
                </span>
                <span className={`badge ${style.badge}`}>{style.label}</span>
              </span>
              <span>
                {u.createdBy?.name || "—"}
                {u.hours != null && u.hours > 0 ? ` · ${u.hours}س` : ""}
              </span>
            </div>
            <p className="text-sm font-medium">{u.workPerformed}</p>
            {u.result ? (
              <p className="mt-1 text-sm text-[var(--muted)]">{u.result}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
