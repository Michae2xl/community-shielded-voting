import { compactVerify, CompactSign } from "jose";
import { sessionPayloadSchema, type SessionPayload } from "@/lib/auth/guards";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const DEV_SESSION_SECRET = "zcap-dev-session-secret";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function getSessionSecret() {
  const secret =
    process.env.ZCAP_SESSION_SECRET ??
    (process.env.NODE_ENV !== "production" ? DEV_SESSION_SECRET : undefined);

  if (!secret) {
    throw new Error("ZCAP_SESSION_SECRET is required");
  }

  return Uint8Array.from(new TextEncoder().encode(secret));
}

export async function createSessionToken(session: SessionPayload) {
  const payload = {
    ...session,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  };

  return new CompactSign(
    Uint8Array.from(encoder.encode(JSON.stringify(payload)))
  )
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .sign(getSessionSecret());
}

export async function verifySessionToken(rawToken: string) {
  try {
    const { payload } = await compactVerify(rawToken, getSessionSecret());
    const parsedPayload = JSON.parse(decoder.decode(payload)) as SessionPayload & {
      exp?: unknown;
    };

    if (
      typeof parsedPayload.exp !== "number" ||
      parsedPayload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    const parsed = sessionPayloadSchema.safeParse(parsedPayload);

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
