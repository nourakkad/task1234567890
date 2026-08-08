"use client";

import { useEffect, useRef } from "react";

type RefreshFn = () => void | Promise<void>;

interface Options {
  /** Default true */
  enabled?: boolean;
  /** Minimum wait in ms (default 2 minutes) */
  minMs?: number;
  /** Maximum wait in ms (default 4 minutes) */
  maxMs?: number;
}

/**
 * Calls `onRefresh` on a random interval between minMs and maxMs.
 * Skips ticks while the browser tab is hidden; reschedules after each run.
 */
export function useAutoRefresh(onRefresh: RefreshFn, options: Options = {}) {
  const { enabled = true, minMs = 2 * 60_000, maxMs = 4 * 60_000 } = options;
  const cbRef = useRef(onRefresh);
  cbRef.current = onRefresh;

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const waitMs = () => {
      const lo = Math.min(minMs, maxMs);
      const hi = Math.max(minMs, maxMs);
      return lo + Math.random() * (hi - lo);
    };

    const schedule = () => {
      timer = setTimeout(async () => {
        if (cancelled) return;
        try {
          if (
            typeof document === "undefined" ||
            document.visibilityState === "visible"
          ) {
            await cbRef.current();
          }
        } catch {
          // ignore background refresh errors
        }
        if (!cancelled) schedule();
      }, waitMs());
    };

    schedule();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, minMs, maxMs]);
}
