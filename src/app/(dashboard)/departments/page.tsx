"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

/** Legacy route — departments are managed by HR now */
export default function DepartmentsRedirectPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    const role = session?.user?.role;
    if (role === "hr") router.replace("/hr/departments");
    else if (role === "ceo" || role === "manager") router.replace("/team");
    else router.replace("/dashboard");
  }, [status, session?.user?.role, router]);

  return <p className="text-[var(--muted)]">جارٍ التحويل...</p>;
}
