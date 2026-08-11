import type { TaskCardData } from "@/components/tasks/TaskCard";

export interface TaskFilterState {
  query: string;
  status: string;
  priority: string;
  departmentId: string;
}

export const EMPTY_TASK_FILTERS: TaskFilterState = {
  query: "",
  status: "",
  priority: "",
  departmentId: "",
};

function deptId(task: TaskCardData): string {
  const d = task.departmentId as unknown;
  if (!d) return "";
  if (typeof d === "string") return d;
  if (typeof d === "object") {
    const obj = d as { _id?: unknown; id?: unknown };
    if (obj._id != null) return String(obj._id);
    if (obj.id != null) return String(obj.id);
  }
  return "";
}

export function filterTasks<T extends TaskCardData>(
  tasks: T[],
  filters: TaskFilterState
): T[] {
  const q = filters.query.trim().toLowerCase();

  return tasks.filter((t) => {
    if (filters.status && t.status !== filters.status) return false;
    if (filters.priority && t.priority !== filters.priority) return false;
    if (filters.departmentId && deptId(t) !== filters.departmentId) {
      return false;
    }

    if (!q) return true;

    const hay = [
      t.taskNo,
      t.name,
      t.description,
      t.status,
      t.priority,
      t.nextAction,
      t.managementDecision,
      t.ownerId?.name,
      t.departmentId?.name,
      t.lastMessage?.text,
      t.lastMessage?.senderName,
      (t as { assignedById?: { name?: string } }).assignedById?.name,
      ...(t.messageTexts || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return hay.includes(q);
  });
}

