"use client";

import { useState } from "react";

/** Shows login password under email for HR/CEO cards. */
export function LoginPasswordLine({ password }: { password?: string | null }) {
  const [visible, setVisible] = useState(false);

  if (!password) {
    return (
      <div className="mt-0.5 text-xs text-[var(--muted)]">
        كلمة المرور: غير محفوظة للعرض — عيّنها من التعديل
      </div>
    );
  }

  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
      <span className="text-[var(--muted)]">كلمة المرور:</span>
      <code className="rounded bg-[var(--brand-soft)] px-1.5 py-0.5 font-mono text-[var(--ink)]">
        {visible ? password : "••••••••"}
      </code>
      <button
        type="button"
        className="font-semibold text-[var(--brand)]"
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? "إخفاء" : "إظهار"}
      </button>
    </div>
  );
}
