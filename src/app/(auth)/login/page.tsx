"use client";

import { FormEvent, useState } from "react";
import { getSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

// Demo shortcuts: on in local/dev; off in production unless explicitly enabled
const DEMO_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === "true" ||
  (process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN !== "false");

const DEMO_ACCOUNTS = [
  { label: "المدير العام", email: "gm@alhadara.com" },
  { label: "المدير التنفيذي", email: "ceo@alhadara.com" },
  { label: "مدير المشتريات", email: "procurement@alhadara.com" },
  { label: "موظف (Iris)", email: "iris@alhadara.com" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError(
        "بيانات الدخول غير صحيحة. بعد عدة محاولات فاشلة يُقفل الحساب مؤقتًا لـ 15 دقيقة."
      );
      return;
    }
    const session = await getSession();
    const role = session?.user?.role;
    if (role === "employee") router.push("/my-tasks");
    else router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,#d7e8e1,transparent_35%),radial-gradient(circle_at_80%_0%,#f0e0cf,transparent_30%),linear-gradient(160deg,#0f5c4c,#16382f_45%,#1c2421)]" />
      <div className="relative w-full max-w-md card p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="text-xs tracking-[0.25em] text-[var(--brand)]">
            إدارة المهام
          </div>
          <h1 className="mt-2 text-2xl font-bold">تسجيل الدخول</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            نظام إدارة المهام
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" autoComplete="on">
          <div className="field">
            <label htmlFor="email">البريد الإلكتروني</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">كلمة المرور</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error ? (
            <p className="text-sm text-[var(--danger)]">{error}</p>
          ) : null}
          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
          >
            {loading ? "جارٍ الدخول..." : "دخول"}
          </button>
        </form>

        {DEMO_ENABLED ? (
          <div className="mt-6 border-t border-[var(--line)] pt-4">
            <p className="mb-2 text-xs text-[var(--muted)]">
              حسابات تجريبية (بيئة تطوير فقط)
            </p>
            <div className="flex flex-col gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  className="btn btn-secondary justify-between text-sm"
                  onClick={() => {
                    setEmail(acc.email);
                    setPassword("");
                  }}
                >
                  <span>{acc.label}</span>
                  <span className="text-[var(--muted)]">{acc.email}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
