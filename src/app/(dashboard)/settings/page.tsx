"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function SettingsRedirectPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (session?.user?.role === "hr") router.replace("/hr/departments");
    else router.replace("/team");
  }, [status, session?.user?.role, router]);

  return <p className="text-[var(--muted)]">جارٍ التحويل...</p>;
}
