"use client";

import { useEffect } from "react";

/** Registers the minimal service worker so the app can be installed. */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // Force check for updated SW (v2 no longer intercepts /api on iPhone)
        void reg.update();
      })
      .catch(() => {
        // ignore registration failures (unsupported / blocked)
      });
  }, []);

  return null;
}
