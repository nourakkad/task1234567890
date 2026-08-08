/**
 * Allow only http(s) URLs for stored links shown as <a href>.
 * Empty string is allowed (optional fields).
 */
export function sanitizeHttpUrl(
  value: unknown,
  fieldLabel = "الرابط"
): { ok: true; value: string } | { ok: false; error: string } {
  if (value == null || value === "") {
    return { ok: true, value: "" };
  }

  const raw = String(value).trim();
  if (!raw) return { ok: true, value: "" };

  if (raw.length > 2000) {
    return { ok: false, error: `${fieldLabel} طويل جدًا` };
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return {
      ok: false,
      error: `${fieldLabel} غير صالح — استخدم رابط http أو https`,
    };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      ok: false,
      error: `${fieldLabel} يجب أن يبدأ بـ http:// أو https://`,
    };
  }

  return { ok: true, value: parsed.toString() };
}
