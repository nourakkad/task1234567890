const STATUS_CLASS: Record<string, string> = {
  "لم تبدأ": "badge-slate",
  "قيد التنفيذ": "badge-teal",
  "بانتظار المورد": "badge-amber",
  "بانتظار قرار الإدارة": "badge-amber",
  معلقة: "badge-red",
  مكتملة: "badge-green",
  ملغاة: "badge-slate",
};

const PRIORITY_CLASS: Record<string, string> = {
  منخفضة: "badge-slate",
  متوسطة: "badge-teal",
  عالية: "badge-amber",
  عاجلة: "badge-red",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${STATUS_CLASS[status] || "badge-slate"}`}>
      {status}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={`badge ${PRIORITY_CLASS[priority] || "badge-slate"}`}>
      {priority}
    </span>
  );
}
