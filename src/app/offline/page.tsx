"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function OfflinePage() {
  const [online, setOnline] = useState(false);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="text-xs tracking-[0.2em] text-[var(--accent)]">ALHDARA</div>
      <h1 className="text-2xl font-bold text-[var(--ink)]">لا يوجد اتصال</h1>
      <p className="text-sm leading-relaxed text-[var(--muted)]">
        التطبيق محفوظ على جهازك. عند عودة الإنترنت ستُرسل التحديثات والأوامر
        المحفوظة تلقائيًا.
      </p>
      {online ? (
        <Link href="/dashboard" className="btn btn-primary">
          المتابعة إلى النظام
        </Link>
      ) : (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => window.location.reload()}
        >
          إعادة المحاولة
        </button>
      )}
    </main>
  );
}
