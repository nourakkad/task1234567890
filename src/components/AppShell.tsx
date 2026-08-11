"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { ROLE_LABELS } from "@/constants/lookups";
import { isNavActive, NAV_LINKS } from "@/components/navLinks";
import { NotificationBell } from "@/components/NotificationBell";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data } = useSession();
  const role = data?.user?.role;
  const [open, setOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll when menu open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const links = NAV_LINKS.filter(
    (link) => !link.roles || (role && link.roles.includes(role))
  );

  return (
    <div className="min-h-screen">
      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--bg-elevated)]/95 px-4 backdrop-blur lg:hidden">
        <button
          type="button"
          className="menu-toggle"
          aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className={open ? "hidden" : "block"}>
            <MenuIcon />
          </span>
          <span className={open ? "block" : "hidden"}>
            <CloseIcon />
          </span>
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
          <Image
            src="/alhadara-logo.png"
            alt="الحضارة"
            width={32}
            height={32}
            className="h-8 w-8 rounded-full bg-white object-contain"
            priority
          />
          <div className="min-w-0 text-start">
            <div className="truncate text-sm font-bold">نظام إدارة المهام</div>
            <div className="truncate text-xs text-[var(--muted)]">
              {data?.user?.name || ""}
            </div>
          </div>
        </div>
        <Link href="/account" className="menu-toggle" aria-label="حسابي">
          <UserIcon />
        </Link>
      </header>

      {/* Overlay */}
      <button
        type="button"
        aria-label="إغلاق القائمة"
        className={`fixed inset-0 z-40 bg-black/45 transition lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setOpen(false)}
      />

      {/* Sidebar / drawer */}
      <aside
        className={`fixed inset-y-0 start-0 z-50 flex w-[min(18rem,86vw)] flex-col bg-[var(--sidebar)] text-[var(--sidebar-ink)] shadow-xl transition-transform duration-200 ease-out lg:z-40 lg:w-64 lg:translate-x-0 lg:shadow-none ${
          open ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-white/10 px-5 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src="/alhadara-logo.png"
              alt="شعار الحضارة"
              width={56}
              height={56}
              className="h-14 w-14 shrink-0 rounded-full bg-white object-contain"
              priority
            />
            <div className="min-w-0">
              <div className="text-xs tracking-[0.2em] text-[var(--accent)]">
                ALHDARA
              </div>
              <h1 className="mt-1 text-lg font-bold leading-tight">
                نظام إدارة المهام
              </h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <NotificationBell variant="dark" />
          </div>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3">
          {links.map((link) => {
            const active = isNavActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`rounded-xl px-3 py-2.5 text-sm transition ${
                  active
                    ? "bg-[var(--accent)]/20 font-semibold text-white"
                    : "text-[var(--sidebar-muted)] hover:bg-white/8 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-white/10 p-4">
          <div className="mb-3 min-w-0">
            <div className="text-sm font-semibold">{data?.user?.name}</div>
            <div className="mt-0.5 text-xs text-[var(--sidebar-muted)]">
              {role ? ROLE_LABELS[role] : ""}
            </div>
          </div>
          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="btn btn-secondary mt-1 w-full text-sm"
          >
            تغيير كلمة المرور
          </Link>
          <button
            type="button"
            className="btn btn-secondary mt-2 w-full text-sm"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            تسجيل الخروج
          </button>
        </div>
      </aside>

      <main className="min-h-screen max-w-[100vw] box-border overflow-x-hidden px-4 pb-8 pt-[4.5rem] sm:px-6 lg:ms-64 lg:max-w-none lg:p-8 lg:pt-8">
        {children}
      </main>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M5 19c1.5-3 4-4.5 7-4.5s5.5 1.5 7 4.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
