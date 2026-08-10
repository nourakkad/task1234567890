"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { getSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { PasswordField } from "@/components/PasswordField";

// Demo shortcuts: on in local/dev; off in production unless explicitly enabled
const DEMO_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === "true" ||
  (process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN !== "false");

const DEMO_ACCOUNTS = [
  { label: "المدير العام", email: "gm@alhadara.com" },
  { label: "المدير التنفيذي", email: "ceo@alhadara.com" },
  { label: "الموارد البشرية", email: "hr@alhadara.com" },
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
    else if (role === "hr") router.push("/hr");
    else router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,#2ebab855,transparent_35%),radial-gradient(circle_at_80%_0%,#aab7c455,transparent_30%),linear-gradient(160deg,#16325c,#163849_50%,#0f2038)]" />
      <div className="relative w-full max-w-md card p-8 shadow-xl">
        <div className="mb-6 text-center">
          <Image
            src="/alhadara-logo.png"
            alt="شعار الحضارة"
            width={96}
            height={96}
            className="mx-auto h-24 w-24 rounded-full bg-black object-contain"
            priority
          />
          <div className="mt-3 text-xs tracking-[0.25em] text-[var(--brand)]">
            ALHDARA
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
          <PasswordField
            id="password"
            name="password"
            label="كلمة المرور"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
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
