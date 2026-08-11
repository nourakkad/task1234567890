"use client";

import { useEffect, useRef } from "react";

/** Fired in the browser when unread notifications increase. */
export const NOTIFICATIONS_EVENT = "alhadara:notifications";

export function emitNotificationsUpdate() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NOTIFICATIONS_EVENT));
}

type RefreshFn = () => void | Promise<void>;

/** Reload data when another tab/user action raises a new notification. */
export function useLiveNotifications(onRefresh: RefreshFn, enabled = true) {
  const cbRef = useRef(onRefresh);
  cbRef.current = onRefresh;

  useEffect(() => {
    if (!enabled) return;
    const handler = () => {
      void cbRef.current();
    };
    window.addEventListener(NOTIFICATIONS_EVENT, handler);
    return () => window.removeEventListener(NOTIFICATIONS_EVENT, handler);
  }, [enabled]);
}
