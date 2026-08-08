import { format, isValid, parseISO } from "date-fns";

export function formatDate(value?: Date | string | null) {
  if (!value) return "—";
  const date = typeof value === "string" ? parseISO(value) : value;
  if (!isValid(date)) return "—";
  return format(date, "yyyy-MM-dd");
}

export function formatPercent(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "0%";
  return `${Math.round(value * 100)}%`;
}

export function toInputDate(value?: Date | string | null) {
  if (!value) return "";
  const date = typeof value === "string" ? parseISO(value) : value;
  if (!isValid(date)) return "";
  return format(date, "yyyy-MM-dd");
}
