/**
 * Same-origin API helpers — safe for iOS Safari / PWA.
 * Never assume the body is JSON (auth middleware used to return HTML /login).
 */

async function readApiBody(res: Response): Promise<unknown> {
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    // HTML login page or empty body after redirect — treat as session loss
    if (
      res.status === 401 ||
      res.status === 403 ||
      contentType.includes("text/html")
    ) {
      throw new Error("UNAUTHORIZED");
    }
    throw new Error("فشل الطلب");
  }
  try {
    return await res.json();
  } catch {
    throw new Error("فشل قراءة الاستجابة");
  }
}

function errorMessage(data: unknown): string {
  if (
    data &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    "error" in data &&
    typeof (data as { error: unknown }).error === "string"
  ) {
    return (data as { error: string }).error;
  }
  return "فشل الطلب";
}

function handleAuthLoss(error: unknown): never {
  if (
    error instanceof Error &&
    error.message === "UNAUTHORIZED" &&
    typeof window !== "undefined" &&
    !window.location.pathname.startsWith("/login")
  ) {
    window.location.assign("/login");
  }
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    throw new Error("انتهت الجلسة — سجّل الدخول مجددًا");
  }
  throw error;
}

export async function apiGet<T>(url: string): Promise<T> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    const data = await readApiBody(res);
    if (!res.ok) {
      if (res.status === 401) throw new Error("UNAUTHORIZED");
      throw new Error(errorMessage(data));
    }
    return data as T;
  } catch (error) {
    handleAuthLoss(error);
  }
}

export async function apiSend<T>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown
): Promise<T> {
  try {
    const res = await fetch(url, {
      method,
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await readApiBody(res);
    if (!res.ok) {
      if (res.status === 401) throw new Error("UNAUTHORIZED");
      throw new Error(errorMessage(data));
    }
    return data as T;
  } catch (error) {
    handleAuthLoss(error);
  }
}
