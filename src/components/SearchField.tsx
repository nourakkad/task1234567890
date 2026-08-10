"use client";

import { useId } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
};

export function SearchField({
  value,
  onChange,
  placeholder = "بحث...",
  label = "بحث",
  className,
}: Props) {
  const id = useId();

  return (
    <div className={`field mb-4 min-w-64 max-w-xl ${className || ""}`}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
    </div>
  );
}

/** Case-insensitive substring match across string parts. */
export function matchesSearch(query: string, ...parts: Array<string | null | undefined>) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return parts.some((p) => (p || "").toLowerCase().includes(q));
}
