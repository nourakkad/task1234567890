"use client";

import { FormEvent, useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/PageHeader";
import { ROLE_LABELS } from "@/constants/lookups";
import { apiSend } from "@/lib/client";

export default function AccountPage() {
  const { data: session } = useSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (newPassword !== confirmPassword) {
      setError("كلمة المرور الجديدة وتأكيدها غير متطابقين");
      return;
    }

    setLoading(true);
    try {
      const res = await apiSend<{ message?: string }>(
        "/api/account/password",
        "PATCH",
        { currentPassword, newPassword, confirmPassword }
      );
      setMessage(res.message || "تم تغيير كلمة المرور بنجاح");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تغيير كلمة المرور");
    } finally {
      setLoading(false);
    }
  }

  const role = session?.user?.role;

  return (
    <div>
      <PageHeader
        title="حسابي"
        subtitle="تغيير كلمة المرور وإدارة بيانات الدخول"
      />

      <div className="mb-4 card max-w-xl p-4">
        <div className="text-sm text-[var(--muted)]">المستخدم</div>
        <div className="mt-1 font-semibold">{session?.user?.name || "—"}</div>
        <div className="text-sm text-[var(--muted)]">
          {session?.user?.email || "—"}
        </div>
        {role ? (
          <div className="mt-1 text-sm">{ROLE_LABELS[role]}</div>
        ) : null}
      </div>

      <form onSubmit={onSubmit} className="card max-w-xl space-y-4 p-5">
        <h3 className="text-lg font-semibold">تغيير كلمة المرور</h3>
        <p className="text-sm text-[var(--muted)]">
          كلمة المرور يجب أن تكون 10 أحرف على الأقل وتحتوي على حروف وأرقام.
        </p>

        <div className="field">
          <label htmlFor="currentPassword">كلمة المرور الحالية</label>
          <input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="newPassword">كلمة المرور الجديدة</label>
          <input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={10}
          />
        </div>

        <div className="field">
          <label htmlFor="confirmPassword">تأكيد كلمة المرور الجديدة</label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={10}
          />
        </div>

        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        {message ? <p className="text-sm text-[var(--ok)]">{message}</p> : null}

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "جارٍ الحفظ..." : "حفظ كلمة المرور"}
        </button>
      </form>
    </div>
  );
}
