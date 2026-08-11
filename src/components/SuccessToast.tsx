"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type SuccessToastContextValue = {
  showSuccess: (message: string) => void;
};

const SuccessToastContext = createContext<SuccessToastContextValue | null>(
  null
);

const AUTO_CLOSE_MS = 2800;

export function SuccessToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSuccess = useCallback((msg: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMessage(msg);
    setOpen(true);
    timerRef.current = setTimeout(() => {
      setOpen(false);
      timerRef.current = null;
    }, AUTO_CLOSE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <SuccessToastContext.Provider value={{ showSuccess }}>
      {children}
      {open && message ? (
        <div
          className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center p-4"
          role="status"
          aria-live="polite"
        >
          <div className="pointer-events-none absolute inset-0 bg-black/25" />
          <div className="success-toast relative w-full max-w-sm rounded-2xl border border-[var(--line)] bg-white px-6 py-7 text-center shadow-xl">
            <div
              className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--brand)]"
              aria-hidden
            >
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <p className="whitespace-pre-line text-base font-bold text-[var(--ink)]">
              {message}
            </p>
          </div>
        </div>
      ) : null}
    </SuccessToastContext.Provider>
  );
}

export function useSuccessToast() {
  const ctx = useContext(SuccessToastContext);
  if (!ctx) {
    return (message: string) => {
      if (typeof window !== "undefined") {
        // fallback if provider missing
        window.alert(message);
      }
    };
  }
  return ctx.showSuccess;
}
