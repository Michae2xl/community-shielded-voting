import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { verifySessionToken } from "@/lib/auth/session-token";
import { buildRequestUrl } from "@/lib/http/request-url";
import { canManagePolls } from "@/lib/auth/guards";

function buildLoginUrl(request: NextRequest, error?: string) {
  const loginUrl = buildRequestUrl(request, "/login");
  loginUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  );

  if (error) {
    loginUrl.searchParams.set("error", error);
  }

  return loginUrl;
}

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/polls") {
    return NextResponse.next();
  }

  const rawToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!rawToken) {
    return NextResponse.redirect(buildLoginUrl(request));
  }

  const session = await verifySessionToken(rawToken);

  if (!session) {
    return NextResponse.redirect(buildLoginUrl(request));
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.redirect(buildLoginUrl(request, "service_unavailable"));
  }

  try {
    if (session.subjectType === "user") {
      const user = await db.user.findUnique({
        where: { id: session.userId }
      });

      if (!user || user.status !== "ACTIVE") {
        return NextResponse.redirect(buildLoginUrl(request));
      }

      if (request.nextUrl.pathname.startsWith("/admin") && !canManagePolls(user.role)) {
        return NextResponse.redirect(buildRequestUrl(request, "/polls"));
      }

      return NextResponse.next();
    }

    const access = await db.pollVoterAccess.findUnique({
      where: { id: session.pollVoterAccessId },
      select: {
        id: true,
        pollId: true,
        status: true,
        expiresAt: true
      }
    });

    if (
      !access ||
      access.status !== "ACTIVE" ||
      access.expiresAt.getTime() <= Date.now()
    ) {
      return NextResponse.redirect(buildLoginUrl(request));
    }

    if (request.nextUrl.pathname.startsWith("/admin")) {
      return NextResponse.redirect(
        buildRequestUrl(request, `/polls/${session.pollId}`)
      );
    }

    return NextResponse.next();
  } catch {
    return NextResponse.redirect(buildLoginUrl(request, "service_unavailable"));
  }
}

export const config = {
  runtime: "nodejs",
  matcher: ["/admin", "/admin/:path*", "/polls", "/polls/:path*"]
};
