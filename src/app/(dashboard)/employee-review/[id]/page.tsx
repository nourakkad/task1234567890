"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function EmployeeReviewDetailRedirect() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "loading") return;
    if (session?.user?.role !== "ceo") {
      router.replace("/dashboard");
      return;
    }
    router.replace(
      `/track/${params.id}?back=${encodeURIComponent("/employee-review")}`
    );
  }, [status, session?.user?.role, params.id, router]);

  return <p className="text-[var(--muted)]">جارٍ فتح المراجعة...</p>;
}
