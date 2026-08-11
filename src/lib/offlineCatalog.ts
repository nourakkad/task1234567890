/** Local cache of tasks/assignees/details for offline reading + actions. */

const DB_NAME = "alhadara-offline-catalog";
const DB_VERSION = 4;
const TASKS = "tasks";
const ASSIGNEES = "assignees";
const META = "meta";
const DETAILS = "taskDetails";

export type OfflineActionMode = "update" | "decision";

export type CachedTask = {
  _id: string;
  taskNo: string;
  name: string;
  status?: string;
  /** ISO date — used to sort newest first */
  sortAt?: string;
  /** True when full detail + timeline were cached */
  hasDetail?: boolean;
};

export type CachedTimelineItem = {
  _id: string;
  updateNo: string;
  date: string;
  createdAt?: string;
  workPerformed: string;
  result?: string;
  entryType?: string;
  hours?: number;
  createdBy?: { name?: string; role?: string };
};

export type CachedTaskDetail = {
  _id: string;
  taskNo: string;
  name: string;
  description?: string;
  status: string;
  priority?: string;
  progress?: number;
  assignedDate?: string;
  targetDate?: string | null;
  lastUpdate?: string | null;
  nextAction?: string;
  managementDecision?: string;
  managerApproval?: string;
  performanceScore?: number | null;
  ownerName?: string;
  ownerRole?: string;
  departmentName?: string;
  assignedByName?: string;
  actionMode: OfflineActionMode;
  timeline: CachedTimelineItem[];
  cachedAt: string;
  sortAt?: string;
};

export type CachedAssignee = {
  _id: string;
  name: string;
  role: string;
  contractType?: string;
  departmentId?: { _id?: string; name?: string } | string | null;
  managedDepartments?: Array<{ _id: string; name: string }>;
};

export type OfflineSessionMeta = {
  key: "session";
  role: string;
  canAssign: boolean;
  canOrder: boolean;
  userId?: string;
};

type TaskLike = {
  _id?: unknown;
  taskNo?: unknown;
  name?: unknown;
  status?: unknown;
  updatedAt?: string | Date;
  createdAt?: string | Date;
  assignedDate?: string | Date;
  ownerId?: unknown;
};

/** Active = not completed and not cancelled. */
export function isActiveTaskStatus(status: unknown): boolean {
  const s = String(status || "");
  return s !== "مكتملة" && s !== "ملغاة";
}

function filterActiveTasks<T extends TaskLike>(tasks: T[] | null | undefined): T[] {
  return (tasks || []).filter((t) => isActiveTaskStatus(t.status));
}

export type UpdateLike = {
  _id?: unknown;
  updateNo?: unknown;
  date?: string | Date;
  createdAt?: string | Date;
  workPerformed?: unknown;
  result?: unknown;
  entryType?: unknown;
  hours?: unknown;
  createdBy?: { name?: string; role?: string } | null;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB غير متاح"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(TASKS)) {
        db.createObjectStore(TASKS, { keyPath: "_id" });
      }
      if (!db.objectStoreNames.contains(ASSIGNEES)) {
        db.createObjectStore(ASSIGNEES, { keyPath: "_id" });
      }
      if (!db.objectStoreNames.contains(META)) {
        db.createObjectStore(META, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(DETAILS)) {
        db.createObjectStore(DETAILS, { keyPath: "_id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("فشل فتح الكتالوج"));
  });
}

function idbReq<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("فشل عملية التخزين"));
  });
}

function waitForTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("فشل المعاملة"));
    tx.onabort = () => reject(tx.error || new Error("أُلغيت المعاملة"));
  });
}

function refId(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "_id" in value) {
    return refId((value as { _id: unknown })._id);
  }
  return String(value);
}

function toIso(value: unknown): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

function taskSortAt(t: TaskLike): string {
  return (
    toIso(t.updatedAt) || toIso(t.createdAt) || toIso(t.assignedDate) || ""
  );
}

function toCachedTask(
  t: TaskLike,
  extras?: { hasDetail?: boolean }
): CachedTask | null {
  const id = refId(t._id);
  if (!id) return null;
  return {
    _id: id,
    taskNo: String(t.taskNo || ""),
    name: String(t.name || ""),
    status: t.status ? String(t.status) : "",
    sortAt: taskSortAt(t),
    hasDetail: extras?.hasDetail,
  };
}

function sortTasksNewestFirst(rows: CachedTask[]): CachedTask[] {
  return [...rows].sort((a, b) => {
    const ta = a.sortAt || "";
    const tb = b.sortAt || "";
    if (ta || tb) return tb.localeCompare(ta);
    return (b.taskNo || "").localeCompare(a.taskNo || "", "ar", {
      numeric: true,
    });
  });
}

function personName(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  return String((value as { name?: string }).name || "");
}

function personRole(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  return String((value as { role?: string }).role || "");
}

function normalizeTimeline(updates: UpdateLike[]): CachedTimelineItem[] {
  const items: CachedTimelineItem[] = [];
  for (const u of updates || []) {
    const id = refId(u._id);
    if (!id) continue;
    items.push({
      _id: id,
      updateNo: String(u.updateNo || ""),
      date: toIso(u.date) || toIso(u.createdAt),
      createdAt: toIso(u.createdAt) || undefined,
      workPerformed: String(u.workPerformed || ""),
      result: u.result ? String(u.result) : "",
      entryType: u.entryType ? String(u.entryType) : "",
      hours: typeof u.hours === "number" ? u.hours : undefined,
      createdBy: u.createdBy
        ? { name: u.createdBy.name, role: u.createdBy.role }
        : undefined,
    });
  }
  return items.sort((a, b) => {
    const ta = new Date(a.createdAt || a.date).getTime();
    const tb = new Date(b.createdAt || b.date).getTime();
    return tb - ta;
  });
}

/** Replace the whole active-task list (does not keep completed/cancelled). */
export async function replaceCachedTasks(tasks: TaskLike[]): Promise<void> {
  const active = filterActiveTasks(tasks);
  try {
    const db = await openDb();
    const tx = db.transaction([TASKS, DETAILS], "readwrite");
    const listStore = tx.objectStore(TASKS);
    const detailStore = tx.objectStore(DETAILS);
    listStore.clear();
    const keepIds = new Set<string>();
    for (const t of active) {
      const row = toCachedTask(t);
      if (!row) continue;
      keepIds.add(row._id);
      listStore.put(row);
    }
    // Drop cached details for closed / removed tasks (no await inside tx)
    const detailReq = detailStore.getAllKeys();
    detailReq.onsuccess = () => {
      const keys = (detailReq.result || []) as IDBValidKey[];
      for (const key of keys) {
        if (!keepIds.has(String(key))) detailStore.delete(key);
      }
    };
    await waitForTx(tx);
    db.close();
    await markDetailsOnList();
  } catch {
    // ignore
  }
}

/** Remove one task from list + detail caches (deleted or closed remotely). */
export async function removeCachedTask(taskId: string): Promise<void> {
  const id = String(taskId || "");
  if (!id) return;
  try {
    const db = await openDb();
    const tx = db.transaction([TASKS, DETAILS], "readwrite");
    tx.objectStore(TASKS).delete(id);
    tx.objectStore(DETAILS).delete(id);
    await waitForTx(tx);
    db.close();
  } catch {
    // ignore
  }
}

/** Drop any locally cached completed/cancelled tasks (list + details). */
export async function pruneClosedCachedTasks(): Promise<void> {
  try {
    const db = await openDb();
    const listRows = await idbReq<CachedTask[]>(
      db.transaction(TASKS, "readonly").objectStore(TASKS).getAll()
    );
    const detailRows = await idbReq<CachedTaskDetail[]>(
      db.transaction(DETAILS, "readonly").objectStore(DETAILS).getAll()
    );
    const dropIds = new Set<string>();
    for (const row of listRows || []) {
      if (!isActiveTaskStatus(row.status)) dropIds.add(String(row._id));
    }
    for (const row of detailRows || []) {
      if (!isActiveTaskStatus(row.status)) dropIds.add(String(row._id));
    }
    if (dropIds.size === 0) {
      db.close();
      return;
    }
    const tx = db.transaction([TASKS, DETAILS], "readwrite");
    for (const id of dropIds) {
      tx.objectStore(TASKS).delete(id);
      tx.objectStore(DETAILS).delete(id);
    }
    await waitForTx(tx);
    db.close();
  } catch {
    // ignore
  }
}

async function markDetailsOnList(): Promise<void> {
  try {
    const db = await openDb();
    const detailIds = await idbReq<IDBValidKey[]>(
      db.transaction(DETAILS, "readonly").objectStore(DETAILS).getAllKeys()
    );
    const idSet = new Set(detailIds.map(String));
    const rows = await idbReq<CachedTask[]>(
      db.transaction(TASKS, "readonly").objectStore(TASKS).getAll()
    );
    const tx = db.transaction(TASKS, "readwrite");
    const store = tx.objectStore(TASKS);
    for (const row of rows || []) {
      store.put({ ...row, hasDetail: idSet.has(row._id) });
    }
    await waitForTx(tx);
    db.close();
  } catch {
    // ignore
  }
}

/** Upsert active tasks; also remove any in this batch that are closed. */
export async function rememberTasks(tasks: TaskLike[]): Promise<void> {
  if (!tasks?.length) return;
  try {
    const db = await openDb();
    const tx = db.transaction([TASKS, DETAILS], "readwrite");
    const listStore = tx.objectStore(TASKS);
    const detailStore = tx.objectStore(DETAILS);
    for (const t of tasks) {
      const id = refId(t._id);
      if (!id) continue;
      if (!isActiveTaskStatus(t.status)) {
        listStore.delete(id);
        detailStore.delete(id);
        continue;
      }
      const row = toCachedTask(t);
      if (row) listStore.put(row);
    }
    await waitForTx(tx);
    db.close();
    await markDetailsOnList();
  } catch {
    // ignore
  }
}

/** Cache full task + message history for offline reading / actions. */
export async function rememberTaskDetail(
  task: Record<string, unknown> & TaskLike,
  updates: UpdateLike[],
  actionMode: OfflineActionMode
): Promise<void> {
  const id = refId(task._id);
  if (!id) return;

  // Do not store closed tasks; remove any stale detail
  if (!isActiveTaskStatus(task.status)) {
    try {
      const db = await openDb();
      const tx = db.transaction([DETAILS, TASKS], "readwrite");
      tx.objectStore(DETAILS).delete(id);
      tx.objectStore(TASKS).delete(id);
      await waitForTx(tx);
      db.close();
    } catch {
      // ignore
    }
    return;
  }

  const detail: CachedTaskDetail = {
    _id: id,
    taskNo: String(task.taskNo || ""),
    name: String(task.name || ""),
    description: task.description ? String(task.description) : "",
    status: String(task.status || ""),
    priority: task.priority ? String(task.priority) : "",
    progress:
      typeof task.progress === "number" ? task.progress : undefined,
    assignedDate: toIso(task.assignedDate) || undefined,
    targetDate: toIso(task.targetDate) || null,
    lastUpdate: toIso(task.lastUpdate) || null,
    nextAction: task.nextAction ? String(task.nextAction) : "",
    managementDecision: task.managementDecision
      ? String(task.managementDecision)
      : "",
    managerApproval: task.managerApproval
      ? String(task.managerApproval)
      : "",
    performanceScore:
      typeof task.performanceScore === "number"
        ? task.performanceScore
        : null,
    ownerName: personName(task.ownerId),
    ownerRole: personRole(task.ownerId),
    departmentName: personName(task.departmentId),
    assignedByName: personName(task.assignedById),
    actionMode,
    timeline: normalizeTimeline(updates),
    cachedAt: new Date().toISOString(),
    sortAt: taskSortAt(task),
  };

  try {
    const db = await openDb();
    const tx = db.transaction([DETAILS, TASKS], "readwrite");
    tx.objectStore(DETAILS).put(detail);
    tx.objectStore(TASKS).put({
      _id: detail._id,
      taskNo: detail.taskNo,
      name: detail.name,
      status: detail.status,
      sortAt: detail.sortAt || detail.cachedAt,
      hasDetail: true,
    } satisfies CachedTask);
    await waitForTx(tx);
    db.close();
  } catch {
    // ignore
  }
}

export async function getCachedTaskDetail(
  taskId: string
): Promise<CachedTaskDetail | null> {
  try {
    const db = await openDb();
    const tx = db.transaction(DETAILS, "readonly");
    const row = await idbReq<CachedTaskDetail | undefined>(
      tx.objectStore(DETAILS).get(taskId)
    );
    db.close();
    return row || null;
  } catch {
    return null;
  }
}

export async function rememberAssignees(
  users: CachedAssignee[]
): Promise<void> {
  if (!users?.length) return;
  try {
    const db = await openDb();
    const tx = db.transaction(ASSIGNEES, "readwrite");
    const store = tx.objectStore(ASSIGNEES);
    for (const u of users) {
      if (!u?._id) continue;
      store.put({
        _id: String(u._id),
        name: String(u.name || ""),
        role: String(u.role || ""),
        contractType: u.contractType,
        departmentId: u.departmentId ?? null,
        managedDepartments: u.managedDepartments,
      } satisfies CachedAssignee);
    }
    await waitForTx(tx);
    db.close();
  } catch {
    // ignore
  }
}

export async function rememberOfflineSession(input: {
  role?: string | null;
  userId?: string | null;
}): Promise<void> {
  const role = String(input.role || "");
  const canAssign =
    role === "general_manager" || role === "ceo" || role === "manager";
  const canOrder =
    role === "general_manager" || role === "ceo" || role === "manager";
  try {
    const db = await openDb();
    const tx = db.transaction(META, "readwrite");
    tx.objectStore(META).put({
      key: "session",
      role,
      canAssign,
      canOrder,
      userId: input.userId ? String(input.userId) : undefined,
    } satisfies OfflineSessionMeta);
    await waitForTx(tx);
    db.close();
  } catch {
    // ignore
  }
}

export async function getOfflineSession(): Promise<OfflineSessionMeta | null> {
  try {
    const db = await openDb();
    const tx = db.transaction(META, "readonly");
    const row = await idbReq<OfflineSessionMeta | undefined>(
      tx.objectStore(META).get("session")
    );
    db.close();
    return row || null;
  } catch {
    return null;
  }
}

export async function listCachedTasks(): Promise<CachedTask[]> {
  try {
    const db = await openDb();
    const tx = db.transaction(TASKS, "readonly");
    const rows = await idbReq<CachedTask[]>(tx.objectStore(TASKS).getAll());
    db.close();
    return sortTasksNewestFirst(
      (rows || []).filter((t) => isActiveTaskStatus(t.status))
    );
  } catch {
    return [];
  }
}

export async function listCachedAssignees(): Promise<CachedAssignee[]> {
  try {
    const db = await openDb();
    const tx = db.transaction(ASSIGNEES, "readonly");
    const rows = await idbReq<CachedAssignee[]>(
      tx.objectStore(ASSIGNEES).getAll()
    );
    db.close();
    return (rows || []).sort((a, b) => a.name.localeCompare(b.name, "ar"));
  } catch {
    return [];
  }
}

export function assigneeDeptId(user: CachedAssignee): string {
  if (!user.departmentId) return "";
  if (typeof user.departmentId === "string") return user.departmentId;
  return user.departmentId._id || "";
}
