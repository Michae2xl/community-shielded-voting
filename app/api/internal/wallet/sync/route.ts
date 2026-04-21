import { NextResponse } from "next/server";
import { getZkoolClient } from "@/lib/zcash/zkool-client";

const DEV_INTERNAL_SECRET = "zcap-dev-internal-secret";

function isAuthorizedInternalRequest(request: Request) {
  const secret =
    process.env.ZCAP_INTERNAL_SECRET ??
    (process.env.NODE_ENV !== "production"
      ? DEV_INTERNAL_SECRET
      : undefined);

  if (!secret) {
    throw new Error("ZCAP_INTERNAL_SECRET is required");
  }

  return request.headers.get("x-zcap-internal-secret") === secret;
}

export async function POST(request: Request) {
  if (!isAuthorizedInternalRequest(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const result = await getZkoolClient().syncWallet();
  return NextResponse.json(result);
}
