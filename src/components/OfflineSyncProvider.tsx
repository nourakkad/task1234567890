"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import { useSuccessToast } from "@/components/SuccessToast";
import {
  countOfflineActions,
  enqueueOfflineAction,
  flushOfflineQueue,
  isBrowserOnline,
  isNetworkError,
  listOfflineActions,
  OFFLINE_QUEUE_EVENT,
  type OfflineAction,
  type OfflineActionType,
} from "@/lib/offlineQueue";
import {
  isActiveTaskStatus,
  rememberAssignees,
  rememberOfflineSession,
  rememberTaskDetail,
  replaceCachedTasks,
  type CachedAssignee,
  type OfflineActionMode,
} from "@/lib/offlineCatalog";
import { emitNotificationsUpdate } from "@/hooks/useLiveNotifications";

async function fetchJsonQuiet<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

type EnqueueInput = {
  type: OfflineActionType;
  label: string;
  payload: Record<string, unknown>;
};

type OfflineSyncContextValue = {
  online: boolean;
  pendingCount: number;
  pending: OfflineAction[];
  syncing: boolean;
  enqueue: (input: EnqueueInput) => Promise<void>;
  /** Try live send; on offline/network error queue instead. */
  sendOrQueue: <T>(opts: {
    label: string;
    type: OfflineActionType;
    payload: Record<string, unknown>;
    send: () => Promise<T>;
  }) => Promise<{ queued: boolean; data?: T }>;
  flushNow: () => Promise<void>;
  refresh: () => Promise<void>;
};

const OfflineSyncContext = createContext<OfflineSyncContextValue | null>(null);

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const { data: session, status: sessionStatus } = useSession();
  const showSuccess = useSuccessToast();
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState<OfflineAction[]>([]);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    const rows = await listOfflineActions();
    setPending(rows);
  }, []);

  const refreshCatalog = useCallback(async () => {
    if (!isBrowserOnline()) return;
    if (sessionStatus !== "authenticated") return;

    const role = session?.user?.role;
    await rememberOfflineSession({
      role,
      userId: session?.user?.id,
    });

    try {
      type TaskRow = {
        _id: string;
        taskNo?: string;
        name?: string;
        status?: string;
        updatedAt?: string;
        createdAt?: string;
        assignedDate?: string;
        ownerId?: unknown;
      };

      type Bucket = { mode: OfflineActionMode; rows: TaskRow[] };
      const buckets: Bucket[] = [];

      const owned =
        (await fetchJsonQuiet<TaskRow[]>("/api/tasks?ownedByMe=1")) ||
        (role === "employee"
          ? await fetchJsonQuiet<TaskRow[]>("/api/tasks?fromManager=1")
          : null) ||
        (role === "manager" || role === "ceo" || role === "hr"
          ? await fetchJsonQuiet<TaskRow[]>("/api/tasks?fromCeo=1")
          : null) ||
        (role === "ceo" || role === "hr"
          ? await fetchJsonQuiet<TaskRow[]>("/api/tasks?fromLeadership=1")
          : null);

      if (Array.isArray(owned)) {
        buckets.push({
          mode: "update",
          rows: owned.filter((t) => isActiveTaskStatus(t.status)),
        });
      }

      if (role === "manager") {
        const team = await fetchJsonQuiet<TaskRow[]>(
          "/api/tasks?teamAssigned=1"
        );
        if (Array.isArray(team)) {
          buckets.push({
            mode: "decision",
            rows: team.filter((t) => isActiveTaskStatus(t.status)),
          });
        }
      }

      if (role === "ceo") {
        const tracked = await fetchJsonQuiet<TaskRow[]>(
          "/api/tasks?managerTasks=1"
        );
        if (Array.isArray(tracked)) {
          buckets.push({
            mode: "decision",
            rows: tracked.filter((t) => isActiveTaskStatus(t.status)),
          });
        }
      }

      if (role === "general_manager") {
        const tracked = await fetchJsonQuiet<TaskRow[]>(
          "/api/tasks?leadershipTasks=1"
        );
        if (Array.isArray(tracked)) {
          buckets.push({
            mode: "decision",
            rows: tracked.filter((t) => isActiveTaskStatus(t.status)),
          });
        }
      }

      const byId = new Map<string, TaskRow>();
      for (const b of buckets) {
        for (const t of b.rows) {
          if (t?._id) byId.set(String(t._id), t);
        }
      }
      const merged = [...byId.values()];
      if (merged.length > 0 || buckets.some((b) => Array.isArray(b.rows))) {
        await replaceCachedTasks(merged);
      }

      const canAssign =
        role === "general_manager" || role === "ceo" || role === "manager";
      if (canAssign) {
        const users = await fetchJsonQuiet<CachedAssignee[]>(
          "/api/users/assignable"
        );
        if (Array.isArray(users)) await rememberAssignees(users);
      }

      // Prefetch full detail + history so offline reading works without
      // opening every task first (cap to keep mobile data light).
      const PREFETCH_CAP = 25;
      const seen = new Set<string>();
      // Prefer decision lists first (orders), then owned updates
      const ordered = [...buckets].reverse();
      for (const b of ordered) {
        for (const stub of b.rows) {
          const id = String(stub._id || "");
          if (!id || seen.has(id)) continue;
          seen.add(id);
          if (seen.size > PREFETCH_CAP) break;
          const [detail, updates] = await Promise.all([
            fetchJsonQuiet<Record<string, unknown>>(`/api/tasks/${id}`),
            fetchJsonQuiet<unknown[]>(`/api/updates?taskId=${id}`),
          ]);
          if (detail) {
            await rememberTaskDetail(
              detail,
              Array.isArray(updates) ? updates : [],
              b.mode
            );
          }
        }
        if (seen.size > PREFETCH_CAP) break;
      }
    } catch {
      // ignore catalog refresh errors
    }
  }, [sessionStatus, session?.user?.role, session?.user?.id]);

  const flushNow = useCallback(async () => {
    if (!isBrowserOnline()) return;
    setSyncing(true);
    try {
      const result = await flushOfflineQueue();
      await refresh();
      if (result.sent > 0) {
        showSuccess(
          result.sent === 1
            ? "تم إرسال العملية المحفوظة"
            : `تم إرسال ${result.sent} عمليات محفوظة`
        );
        emitNotificationsUpdate();
      }
      await refreshCatalog();
    } finally {
      setSyncing(false);
    }
  }, [refresh, refreshCatalog, showSuccess]);

  const enqueue = useCallback(
    async (input: EnqueueInput) => {
      await enqueueOfflineAction(input);
      await refresh();
      showSuccess("تم الحفظ على الجهاز — سيُرسل عند توفر الإنترنت");
    },
    [refresh, showSuccess]
  );

  const sendOrQueue = useCallback(
    async <T,>(opts: {
      label: string;
      type: OfflineActionType;
      payload: Record<string, unknown>;
      send: () => Promise<T>;
    }) => {
      if (!isBrowserOnline()) {
        await enqueue({
          type: opts.type,
          label: opts.label,
          payload: opts.payload,
        });
        return { queued: true as const };
      }
      try {
        const data = await opts.send();
        return { queued: false as const, data };
      } catch (err) {
        if (isNetworkError(err) || !isBrowserOnline()) {
          await enqueue({
            type: opts.type,
            label: opts.label,
            payload: opts.payload,
          });
          return { queued: true as const };
        }
        throw err;
      }
    },
    [enqueue]
  );

  useEffect(() => {
    setOnline(isBrowserOnline());
    void refresh();

    const onOnline = () => {
      setOnline(true);
      void flushNow();
      void refreshCatalog();
    };
    const onOffline = () => setOnline(false);
    const onQueue = () => void refresh();

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener(OFFLINE_QUEUE_EVENT, onQueue);

    if (isBrowserOnline()) {
      void countOfflineActions().then((n) => {
        if (n > 0) void flushNow();
      });
    }

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener(OFFLINE_QUEUE_EVENT, onQueue);
    };
  }, [flushNow, refresh, refreshCatalog]);

  // Seed owned-task catalog once the session is ready
  useEffect(() => {
    if (sessionStatus === "authenticated" && isBrowserOnline()) {
      void refreshCatalog();
    }
  }, [sessionStatus, refreshCatalog]);

  const value = useMemo<OfflineSyncContextValue>(
    () => ({
      online,
      pendingCount: pending.length,
      pending,
      syncing,
      enqueue,
      sendOrQueue,
      flushNow,
      refresh,
    }),
    [
      online,
      pending,
      syncing,
      enqueue,
      sendOrQueue,
      flushNow,
      refresh,
    ]
  );

  return (
    <OfflineSyncContext.Provider value={value}>
      {children}
    </OfflineSyncContext.Provider>
  );
}

export function useOfflineSync() {
  const ctx = useContext(OfflineSyncContext);
  if (!ctx) {
    throw new Error("useOfflineSync must be used within OfflineSyncProvider");
  }
  return ctx;
}
