"use client";

type Props = {
  value: number | null;
  onChange?: (score: number) => void;
  disabled?: boolean;
  label?: string;
};

export function StarRating({
  value,
  onChange,
  disabled,
  label = "تقييم الأداء (من 1 إلى 10)",
}: Props) {
  const scores = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  return (
    <div className="field">
      <label>{label}</label>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {scores.map((n) => {
          const selected = value === n;
          const filled = value != null && n <= value;
          return (
            <button
              key={n}
              type="button"
              disabled={disabled || !onChange}
              onClick={() => onChange?.(n)}
              className={`min-w-9 rounded-lg border px-2.5 py-1.5 text-sm font-semibold transition ${
                selected
                  ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                  : filled
                    ? "border-amber-300 bg-amber-50 text-amber-900"
                    : "border-[var(--line)] bg-white text-[var(--ink)]"
              } ${disabled || !onChange ? "cursor-default opacity-80" : "hover:border-[var(--brand)]"}`}
              aria-pressed={selected}
            >
              {n}
            </button>
          );
        })}
      </div>
      {value != null ? (
        <p className="text-xs text-[var(--muted)]">التقييم المحدد: {value}/10</p>
      ) : onChange && !disabled ? (
        <p className="text-xs text-[var(--muted)]">
          اختر التقييم قبل إنهاء المهمة
        </p>
      ) : null}
    </div>
  );
}
