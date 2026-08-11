/** Local cache of tasks/assignees for composing offline actions. */

const DB_NAME = "alhadara-offline-catalog";
const DB_VERSION = 1;
const TASKS = "tasks";
const ASSIGNEES = "assignees";

export type CachedTask = {
  _id: string;
  taskNo: string;
  name: string;
  status?: string;
};

export type CachedAssignee = {
  _id: string;
  name: string;
  role: string;
  contractType?: string;
  departmentId?: { _id?: string; name?: string } | string | null;
  managedDepartments?: Array<{ _id: string; name: string }>;
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

export async function rememberTasks(
  tasks: Array<{
    _id: string;
    taskNo?: string;
    name?: string;
    status?: string;
  }>
): Promise<void> {
  if (!tasks?.length) return;
  try {
    const db = await openDb();
    const tx = db.transaction(TASKS, "readwrite");
    const store = tx.objectStore(TASKS);
    for (const t of tasks) {
      if (!t?._id) continue;
      store.put({
        _id: String(t._id),
        taskNo: String(t.taskNo || ""),
        name: String(t.name || ""),
        status: t.status ? String(t.status) : "",
      } satisfies CachedTask);
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore
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
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore
  }
}

export async function listCachedTasks(): Promise<CachedTask[]> {
  try {
    const db = await openDb();
    const tx = db.transaction(TASKS, "readonly");
    const rows = await idbReq<CachedTask[]>(tx.objectStore(TASKS).getAll());
    db.close();
    return (rows || []).sort((a, b) =>
      (a.taskNo || "").localeCompare(b.taskNo || "", "ar")
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
