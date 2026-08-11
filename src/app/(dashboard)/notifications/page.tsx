"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/PageHeader";
import { useLiveNotifications } from "@/hooks/useLiveNotifications";
import { apiGet, apiSend } from "@/lib/client";

interface NotifItem {
  _id: string;
  type: string;
  title: string;
  body?: string;
  href?: string;
  readAt?: string | null;
  createdAt: string;
}

const TYPE_LABEL: Record<string, string> = {
  task_assigned: "تكليف جديد",
  task_update: "تحديث",
  awaiting_decision: "بانتظار قرار",
  decision_made: "قرار",
};

export default function NotificationsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<NotifItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await apiGet<{ items: NotifItem[]; unreadCount: number }>(
        "/api/notifications"
      );
      setItems(data.items || []);
      setUnreadCount(data.unreadCount || 0);
      setError("");
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : "فشل التحميل");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    if (status !== "authenticated") {
      router.replace("/login");
      return;
    }
    void load(false);
  }, [status, router, load]);

  useLiveNotifications(() => {
    void load(true);
  }, status === "authenticated");

  async function openItem(n: NotifItem) {
    try {
      await apiSend("/api/notifications", "PATCH", { id: n._id });
    } catch {
      // ignore
    }
    if (n.href) router.push(n.href);
    else void load();
  }

  async function markAll() {
    await apiSend("/api/notifications", "PATCH", { all: true });
    await load();
  }

  if (status === "loading" || loading) {
    return <p className="text-[var(--muted)]">جارٍ التحميل...</p>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="الإشعارات"
        subtitle={
          unreadCount > 0
            ? `لديك ${unreadCount} إشعار غير مقروء`
            : "كل الإشعارات مقروءة"
        }
        actions={
          unreadCount > 0 ? (
            <button type="button" className="btn btn-secondary" onClick={() => void markAll()}>
              تعليم الكل كمقروء
            </button>
          ) : (
            <Link href="/" className="btn btn-secondary">
              العودة
            </Link>
          )
        }
      />

      {error ? <p className="mb-3 text-[var(--danger)]">{error}</p> : null}

      {items.length === 0 ? (
        <div className="card p-8 text-center text-[var(--muted)]">
          لا توجد إشعارات بعد
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <button
              key={n._id}
              type="button"
              onClick={() => void openItem(n)}
              className={`card w-full p-4 text-start transition hover:border-[var(--brand)] ${
                n.readAt ? "" : "border-[var(--accent)]/40 bg-[var(--brand-soft)]/40"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge badge-slate">
                  {TYPE_LABEL[n.type] || n.type}
                </span>
                {!n.readAt ? (
                  <span className="badge badge-teal">جديد</span>
                ) : null}
                <span className="ms-auto text-xs text-[var(--muted)]">
                  {new Date(n.createdAt).toLocaleString("ar-SY")}
                </span>
              </div>
              <div className="mt-2 font-semibold">{n.title}</div>
              {n.body ? (
                <p className="mt-1 text-sm text-[var(--muted)]">{n.body}</p>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
