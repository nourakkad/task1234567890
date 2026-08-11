import { apiSend } from "@/lib/client";

const DB_NAME = "alhadara-offline";
const STORE = "queue";
const DB_VERSION = 1;

export type OfflineActionType =
  | "create_task"
  | "create_update"
  | "task_decision";

export type OfflineAction = {
  id: string;
  type: OfflineActionType;
  createdAt: string;
  label: string;
  payload: Record<string, unknown>;
};

export const OFFLINE_QUEUE_EVENT = "alhadara:offline-queue";

function notifyQueueChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OFFLINE_QUEUE_EVENT));
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB غير متاح"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("فشل فتح التخزين"));
  });
}

function idbReq<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("فشل عملية التخزين"));
  });
}

export function newOfflineId() {
  return `off_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function listOfflineActions(): Promise<OfflineAction[]> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const rows = await idbReq<OfflineAction[]>(store.getAll());
    db.close();
    return (rows || []).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt)
    );
  } catch {
    return [];
  }
}

export async function enqueueOfflineAction(
  input: Omit<OfflineAction, "id" | "createdAt"> & { id?: string }
): Promise<OfflineAction> {
  const action: OfflineAction = {
    id: input.id || newOfflineId(),
    type: input.type,
    label: input.label,
    payload: input.payload,
    createdAt: new Date().toISOString(),
  };
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  await idbReq(tx.objectStore(STORE).put(action));
  db.close();
  notifyQueueChanged();
  return action;
}

export async function removeOfflineAction(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  await idbReq(tx.objectStore(STORE).delete(id));
  db.close();
  notifyQueueChanged();
}

export async function countOfflineActions(): Promise<number> {
  const rows = await listOfflineActions();
  return rows.length;
}

async function sendAction(action: OfflineAction): Promise<void> {
  if (action.type === "create_task") {
    await apiSend("/api/tasks", "POST", action.payload);
    return;
  }
  if (action.type === "create_update") {
    await apiSend("/api/updates", "POST", action.payload);
    return;
  }
  if (action.type === "task_decision") {
    const taskId = String(action.payload.taskId || "");
    if (!taskId) throw new Error("معرّف المهمة مفقود");
    const { taskId: _omit, ...body } = action.payload;
    await apiSend(`/api/tasks/${taskId}/approve`, "POST", body);
  }
}

export type FlushResult = {
  sent: number;
  failed: number;
  remaining: number;
};

let flushing = false;

/** Send queued actions oldest-first. Stops on first network failure. */
export async function flushOfflineQueue(): Promise<FlushResult> {
  if (flushing) {
    const remaining = await countOfflineActions();
    return { sent: 0, failed: 0, remaining };
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const remaining = await countOfflineActions();
    return { sent: 0, failed: 0, remaining };
  }

  flushing = true;
  let sent = 0;
  let failed = 0;
  try {
    const actions = await listOfflineActions();
    for (const action of actions) {
      try {
        await sendAction(action);
        await removeOfflineAction(action.id);
        sent += 1;
      } catch (err) {
        failed += 1;
        // Keep item for retry; stop if still offline / network
        if (isNetworkError(err) || (typeof navigator !== "undefined" && !navigator.onLine)) {
          break;
        }
        // Server validation error: leave in queue for manual retry later
        break;
      }
    }
  } finally {
    flushing = false;
  }
  const remaining = await countOfflineActions();
  if (sent > 0) notifyQueueChanged();
  return { sent, failed, remaining };
}

export function isBrowserOnline() {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const name = error.name || "";
  const msg = (error.message || "").toLowerCase();
  return (
    name === "TypeError" ||
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("load failed")
  );
}
