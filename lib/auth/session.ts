import { cookies } from "next/headers";
import {
  SESSION_COOKIE_NAME,
  type SessionPayload
} from "@/lib/auth/guards";
import {
  createSessionToken,
  verifySessionToken
} from "@/lib/auth/session-token";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export async function readSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = await verifySessionToken(token);

  if (!session) {
    return null;
  }

  if (!process.env.DATABASE_URL) {
    return null;
  }

  const { db } = await import("@/lib/db");

  if (session.subjectType === "user") {
    const user = await db.user.findUnique({
      where: { id: session.userId }
    });

    if (!user || user.status !== "ACTIVE") {
      return null;
    }

    return {
      subjectType: "user",
      userId: user.id,
      nick: user.nick,
      role: user.role
    } satisfies SessionPayload;
  }

  const access = await db.pollVoterAccess.findUnique({
    where: { id: session.pollVoterAccessId },
    select: {
      id: true,
      pollId: true,
      nick: true,
      status: true,
      expiresAt: true
    }
  });

  if (
    !access ||
    access.status !== "ACTIVE" ||
    access.expiresAt.getTime() <= Date.now()
  ) {
    return null;
  }

  return {
    subjectType: "poll_voter_access",
    userId: "",
    pollVoterAccessId: access.id,
    pollId: access.pollId,
    nick: access.nick,
    role: "VOTER_TEMP"
  } satisfies SessionPayload;
}

export async function writeSessionCookie(session: SessionPayload) {
  const cookieStore = await cookies();
  const token = await createSessionToken(session);

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  });
}

export { createSessionToken, verifySessionToken };

export async function clearSessionCookie() {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}
