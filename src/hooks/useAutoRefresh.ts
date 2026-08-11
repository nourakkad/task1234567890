"use client";

import { useEffect, useRef } from "react";

type RefreshFn = () => void | Promise<void>;

interface Options {
  /** Default true */
  enabled?: boolean;
  /** Minimum wait in ms (default 5 minutes) */
  minMs?: number;
  /** Maximum wait in ms (default 8 minutes) */
  maxMs?: number;
}

/**
 * Calls `onRefresh` on a random interval between minMs and maxMs.
 * Also refreshes when the tab/app becomes visible again (important on iPhone).
 */
export function useAutoRefresh(onRefresh: RefreshFn, options: Options = {}) {
  const { enabled = true, minMs = 5 * 60_000, maxMs = 8 * 60_000 } = options;
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

    const run = async () => {
      try {
        await cbRef.current();
      } catch {
        // keep polling; auth errors are handled in apiGet
      }
    };

    const schedule = () => {
      timer = setTimeout(async () => {
        if (cancelled) return;
        if (
          typeof document === "undefined" ||
          document.visibilityState === "visible"
        ) {
          await run();
        }
        if (!cancelled) schedule();
      }, waitMs());
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void run();
      }
    };

    // pageshow fires on iOS when restoring from bfcache / home screen
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) void run();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    schedule();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [enabled, minMs, maxMs]);
}
