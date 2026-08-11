import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function proxy(req) {
    const res = NextResponse.next();
    res.headers.set("X-Frame-Options", "DENY");
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

    const role = req.nextauth.token?.role as string | undefined;
    const path = req.nextUrl.pathname;

    if (path.startsWith("/hr") && role && role !== "hr") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    if (
      role === "hr" &&
      !path.startsWith("/hr") &&
      !path.startsWith("/account") &&
      !path.startsWith("/notifications") &&
      !path.startsWith("/api/")
    ) {
      if (
        path.startsWith("/dashboard") ||
        path.startsWith("/team") ||
        path.startsWith("/departments") ||
        path.startsWith("/tasks") ||
        path.startsWith("/track")
      ) {
        return NextResponse.redirect(new URL("/hr", req.url));
      }
    }

    if (path.startsWith("/my-tasks") && role && role !== "employee") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    if (path.startsWith("/ceo-tasks") && role && role !== "ceo") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    if (
      (path.startsWith("/track") || path.startsWith("/employee-review")) &&
      role &&
      role !== "ceo" &&
      role !== "general_manager"
    ) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    if (path.startsWith("/settings") && role && role !== "ceo" && role !== "hr") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return res;
  },
  {
    pages: {
      signIn: "/login",
    },
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;
        if (path.startsWith("/api/auth")) return true;
        return !!token?.id;
      },
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/hr/:path*",
    "/track/:path*",
    "/employee-review/:path*",
    "/manager-tasks/:path*",
    "/team-tasks/:path*",
    "/my-tasks/:path*",
    "/tasks/:path*",
    "/updates/:path*",
    "/suppliers/:path*",
    "/documents/:path*",
    "/ceo-tasks/:path*",
    "/team/:path*",
    "/departments/:path*",
    "/settings/:path*",
    "/account/:path*",
    "/notifications/:path*",
    // API routes authenticate themselves via requireSessionUser (JSON 401).
    // Do not put /api in this matcher — withAuth redirects to HTML /login,
    // which breaks fetch().json() on iPhone Safari / PWA.
  ],
};
