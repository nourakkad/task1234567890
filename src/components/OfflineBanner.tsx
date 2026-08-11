"use client";

import { useOfflineSync } from "@/components/OfflineSyncProvider";

export function OfflineBanner() {
  const { online, pendingCount, syncing, flushNow } = useOfflineSync();

  if (online && pendingCount === 0 && !syncing) return null;

  return (
    <div
      className={`sticky top-0 z-[70] border-b px-4 py-2 text-sm lg:top-0 ${
        online
          ? "border-amber-200 bg-amber-50 text-[var(--ink)]"
          : "border-red-200 bg-red-50 text-[var(--danger)]"
      }`}
      role="status"
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
        <div>
          {!online ? (
            <span className="font-semibold">لا يوجد اتصال بالإنترنت</span>
          ) : syncing ? (
            <span className="font-semibold">جارٍ إرسال العمليات المحفوظة...</span>
          ) : (
            <span className="font-semibold">
              لديك {pendingCount}{" "}
              {pendingCount === 1 ? "عملية محفوظة" : "عمليات محفوظة"} بانتظار
              الإرسال
            </span>
          )}
          <span className="ms-2 text-[var(--muted)]">
            {!online
              ? "يمكنك المتابعة — سيُحفظ الرد أو الإسناد على الجهاز ويُرسل لاحقًا"
              : syncing
                ? ""
                : "اضغط مزامنة الآن أو انتظر الاتصال"}
          </span>
        </div>
        {online && pendingCount > 0 && !syncing ? (
          <button
            type="button"
            className="btn btn-secondary text-xs"
            onClick={() => void flushNow()}
          >
            مزامنة الآن
          </button>
        ) : null}
      </div>
    </div>
  );
}
