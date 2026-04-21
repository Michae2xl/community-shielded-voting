import { NextResponse } from "next/server";
import { getRequestOrigin } from "@/lib/http/request-url";

function readSourceOrigin(request: Pick<Request, "headers">) {
  const origin = request.headers.get("origin");

  if (origin) {
    return origin;
  }

  const referer = request.headers.get("referer");

  if (!referer) {
    return null;
  }

  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

export function hasTrustedWriteOrigin(
  request: Pick<Request, "headers" | "url">
) {
  const sourceOrigin = readSourceOrigin(request);

  if (!sourceOrigin) {
    return false;
  }

  const allowedOrigins = new Set([getRequestOrigin(request)]);

  if (process.env.APP_BASE_URL) {
    try {
      allowedOrigins.add(new URL(process.env.APP_BASE_URL).origin);
    } catch {
      // Ignore an invalid APP_BASE_URL and fall back to the request origin.
    }
  }

  return allowedOrigins.has(sourceOrigin);
}

export function rejectIfUntrustedWriteOrigin(
  request: Pick<Request, "headers" | "url">
) {
  if (hasTrustedWriteOrigin(request)) {
    return null;
  }

  return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
}
