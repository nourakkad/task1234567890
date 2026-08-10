"use client";

import { useEffect } from "react";

/** Registers the minimal service worker so the app can be installed. */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // ignore registration failures (unsupported / blocked)
    });
  }, []);

  return null;
}
