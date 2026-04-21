import { NextResponse, type NextRequest } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";
import { buildRequestUrl } from "@/lib/http/request-url";
import { rejectIfUntrustedWriteOrigin } from "@/lib/http/write-origin";

export async function POST(request: NextRequest) {
  const untrustedOrigin = rejectIfUntrustedWriteOrigin(request);

  if (untrustedOrigin) {
    return untrustedOrigin;
  }

  await clearSessionCookie();

  return NextResponse.redirect(buildRequestUrl(request, "/login"), 303);
}
