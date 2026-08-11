"use client";

import { SessionProvider } from "next-auth/react";
import { OfflineSyncProvider } from "@/components/OfflineSyncProvider";
import { SuccessToastProvider } from "@/components/SuccessToast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider
      // iOS Safari / PWA: re-check session when returning to the app
      refetchOnWindowFocus={true}
      refetchInterval={5 * 60}
    >
      <SuccessToastProvider>
        <OfflineSyncProvider>{children}</OfflineSyncProvider>
      </SuccessToastProvider>
    </SessionProvider>
  );
}
