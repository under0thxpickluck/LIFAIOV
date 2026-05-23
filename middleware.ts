import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function unauthorized(realm: string) {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${realm}"`,
    },
  });
}

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // OVでは /purchase/jam と /purchase は存在しない（5000専用サイト）
  if (
    pathname === "/purchase/jam" ||
    pathname.startsWith("/purchase/jam/") ||
    pathname === "/purchase" ||
    pathname.startsWith("/purchase/")
  ) {
    return NextResponse.redirect(new URL("/5000", req.url));
  }

  // ✅ /admin, /api/admin をガード（/note-generator は BP 課金に移行）
  const isProtected =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/5000/admin") ||
    pathname.startsWith("/api/5000/admin");
  if (!isProtected) return NextResponse.next();

  const user = process.env.ADMIN_USER || "";
  const pass = process.env.ADMIN_PASS || "";
  if (!user || !pass) return unauthorized("LIFAI Admin");

  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Basic ")) return unauthorized("LIFAI Admin");

  const base64 = auth.slice(6);
  const [u, p] = Buffer.from(base64, "base64").toString().split(":");

  if (u !== user || p !== pass) return unauthorized("LIFAI Admin");

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/purchase",
    "/purchase/:path*",
    "/admin/:path*",
    "/api/admin/:path*",
    "/5000/admin/:path*",
    "/5000/admin",
    "/api/5000/admin/:path*",
  ],
};
