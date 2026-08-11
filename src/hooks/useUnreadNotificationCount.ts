"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useLiveNotifications } from "@/hooks/useLiveNotifications";
import { apiGet } from "@/lib/client";

const POLL_MS = 8_000;

/** Shared unread notification count for bell + mobile menu badge. */
export function useUnreadNotificationCount(enabled = true) {
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const data = await apiGet<{ unreadCount: number }>(
        "/api/notifications?count=1"
      );
      setCount(data.unreadCount || 0);
    } catch {
      // ignore
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }

    void load();

    const tick = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        return;
      }
      void load();
    };

    const t = setInterval(tick, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, load, pathname]);

  useLiveNotifications(load, enabled);

  return count;
}
