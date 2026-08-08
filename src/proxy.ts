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

    // Soft role gates at the edge (APIs still enforce permissions)
    if (path.startsWith("/my-tasks") && role && role !== "employee") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    if (
      (path.startsWith("/track") || path.startsWith("/employee-review")) &&
      role &&
      role !== "ceo"
    ) {
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
    "/track/:path*",
    "/employee-review/:path*",
    "/manager-tasks/:path*",
    "/team-tasks/:path*",
    "/my-tasks/:path*",
    "/tasks/:path*",
    "/updates/:path*",
    "/suppliers/:path*",
    "/documents/:path*",
    "/team/:path*",
    "/settings/:path*",
    "/account/:path*",
    "/api/((?!auth).*)",
  ],
};
