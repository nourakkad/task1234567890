"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { useSuccessToast } from "@/components/SuccessToast";
import { emitNotificationsUpdate } from "@/hooks/useLiveNotifications";
import { apiGet, apiSend } from "@/lib/client";

interface NotifItem {
  _id: string;
  type: string;
  title: string;
  body?: string;
  href?: string;
  readAt?: string | null;
  createdAt: string;
  actorId?: { name?: string } | null;
  taskId?: { _id?: string; taskNo?: string; name?: string } | null;
}

const POLL_MS = 8_000;

export function NotificationBell({
  variant = "light",
}: {
  variant?: "light" | "dark";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const showSuccess = useSuccessToast();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef<number | null>(null);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    setMounted(true);
  }, []);

  const announceNew = useCallback(
    async (nextCount: number) => {
      emitNotificationsUpdate();
      try {
        const data = await apiGet<{ items: NotifItem[] }>(
          "/api/notifications?unread=1"
        );
        const newest = data.items?.[0];
        if (newest) {
          const text = newest.body
            ? `${newest.title}\n${newest.body}`
            : newest.title;
          showSuccess(text);
        } else {
          showSuccess(
            nextCount === 1
              ? "لديك إشعار جديد"
              : `لديك ${nextCount} إشعارات جديدة`
          );
        }
      } catch {
        showSuccess("لديك إشعار جديد");
      }
      if (openRef.current) {
        try {
          const data = await apiGet<{ items: NotifItem[]; unreadCount: number }>(
            "/api/notifications"
          );
          setItems(data.items || []);
          setUnreadCount(data.unreadCount || 0);
        } catch {
          // ignore
        }
      }
    },
    [showSuccess]
  );

  const loadCount = useCallback(async () => {
    try {
      const data = await apiGet<{ unreadCount: number }>(
        "/api/notifications?count=1"
      );
      const next = data.unreadCount || 0;
      const prev = prevCountRef.current;
      prevCountRef.current = next;
      setUnreadCount(next);
      if (prev !== null && next > prev) {
        void announceNew(next);
      }
    } catch {
      // ignore
    }
  }, [announceNew]);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ items: NotifItem[]; unreadCount: number }>(
        "/api/notifications"
      );
      setItems(data.items || []);
      const next = data.unreadCount || 0;
      prevCountRef.current = next;
      setUnreadCount(next);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCount();

    const tick = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        return;
      }
      void loadCount();
    };

    const t = setInterval(tick, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") void loadCount();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) void loadCount();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [loadCount, pathname]);

  useEffect(() => {
    if (!open) return;
    void loadList();
  }, [open, loadList]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function markOne(n: NotifItem) {
    try {
      const res = await apiSend<{ unreadCount: number }>(
        "/api/notifications",
        "PATCH",
        { id: n._id }
      );
      const next = res.unreadCount ?? Math.max(0, unreadCount - 1);
      prevCountRef.current = next;
      setUnreadCount(next);
      setItems((prev) =>
        prev.map((x) =>
          x._id === n._id ? { ...x, readAt: new Date().toISOString() } : x
        )
      );
    } catch {
      // ignore
    }
    setOpen(false);
    if (n.href) router.push(n.href);
    emitNotificationsUpdate();
  }

  async function markAll() {
    try {
      await apiSend("/api/notifications", "PATCH", { all: true });
      prevCountRef.current = 0;
      setUnreadCount(0);
      setItems((prev) =>
        prev.map((x) => ({
          ...x,
          readAt: x.readAt || new Date().toISOString(),
        }))
      );
      emitNotificationsUpdate();
    } catch {
      // ignore
    }
  }

  const btnClass =
    variant === "dark"
      ? "relative rounded-xl p-2 text-white/90 hover:bg-white/10"
      : "menu-toggle relative";

  const panel = open ? (
    <div
      ref={panelRef}
      className="fixed z-[70] inset-x-3 top-[4.75rem] max-h-[min(70vh,28rem)] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--bg-elevated)] text-[var(--ink)] shadow-xl lg:inset-x-auto lg:start-3 lg:top-20 lg:w-[min(22rem,calc(100vw-1.5rem))]"
      role="dialog"
      aria-label="الإشعارات"
    >
      <div className="flex items-center justify-between border-b border-[var(--line)] px-3 py-2.5">
        <div className="font-semibold text-[var(--ink)]">الإشعارات</div>
        {unreadCount > 0 ? (
          <button
            type="button"
            className="text-xs font-semibold text-[var(--brand)]"
            onClick={() => void markAll()}
          >
            تعليم الكل كمقروء
          </button>
        ) : null}
      </div>

      <div className="max-h-[min(60vh,24rem)] overflow-y-auto">
        {loading ? (
          <p className="p-4 text-sm text-[var(--muted)]">جارٍ التحميل...</p>
        ) : items.length === 0 ? (
          <p className="p-4 text-sm text-[var(--muted)]">لا إشعارات بعد</p>
        ) : (
          items.map((n) => (
            <button
              key={n._id}
              type="button"
              onClick={() => void markOne(n)}
              className={`block w-full border-b border-[var(--line)] px-3 py-3 text-start text-[var(--ink)] last:border-0 hover:bg-[var(--brand-soft)] ${
                n.readAt ? "opacity-70" : ""
              }`}
            >
              <div className="flex items-start gap-2">
                {!n.readAt ? (
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" />
                ) : (
                  <span className="mt-1.5 h-2 w-2 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-[var(--ink)]">
                    {n.title}
                  </div>
                  {n.body ? (
                    <div className="mt-0.5 line-clamp-2 text-xs text-[var(--muted)]">
                      {n.body}
                    </div>
                  ) : null}
                  <div className="mt-1 text-[10px] text-[var(--muted)]">
                    {formatWhen(n.createdAt)}
                  </div>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className={btnClass}
        aria-label="الإشعارات"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <BellIcon />
        {unreadCount > 0 ? (
          <span className="absolute -top-0.5 -end-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {mounted && panel ? createPortal(panel, document.body) : null}
    </div>
  );
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("ar-SY", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function BellIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 9a6 6 0 1 1 12 0c0 3.5 1.5 5 1.5 5H4.5S6 12.5 6 9Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M10 19a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
