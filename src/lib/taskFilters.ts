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
  const d = task.departmentId as { _id?: string; name?: string } | null | undefined;
  if (!d) return "";
  if (typeof d === "object" && d._id) return String(d._id);
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
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return hay.includes(q);
  });
}

export function uniqueDepartments(
  tasks: TaskCardData[]
): Array<{ id: string; name: string }> {
  const map = new Map<string, string>();
  for (const t of tasks) {
    const d = t.departmentId as
      | { _id?: string; name?: string }
      | null
      | undefined;
    if (d?._id && d.name) map.set(String(d._id), d.name);
  }
  return Array.from(map.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));
}
