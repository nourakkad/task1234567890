import {
  rememberTaskDetail,
  type OfflineActionMode,
} from "@/lib/offlineCatalog";

/** Persist a task + its timeline for offline reading / actions. */
export function seedOfflineTask(
  task: Record<string, unknown> | null | undefined,
  updates: unknown[] | null | undefined,
  actionMode: OfflineActionMode
) {
  if (!task || typeof task !== "object") return;
  void rememberTaskDetail(
    task as Record<string, unknown>,
    Array.isArray(updates) ? (updates as []) : [],
    actionMode
  );
}
