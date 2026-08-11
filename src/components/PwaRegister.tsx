"use client";

import { useEffect } from "react";

/** Registers the PWA service worker (shell cache, no /api intercept). */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      })
      .then((reg) => {
        void reg.update();
      })
      .catch(() => {
        // ignore registration failures (unsupported / blocked)
      });
  }, []);

  return null;
}
