import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { canManagePolls } from "@/lib/auth/guards";
import { writeSessionCookie } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { buildRequestUrl } from "@/lib/http/request-url";
import { rejectIfUntrustedWriteOrigin } from "@/lib/http/write-origin";
import { markPollInviteOpened } from "@/lib/services/poll-invites";
import { authenticateTemporaryPollVoter } from "@/lib/services/poll-voter-access";

function isSafeInternalPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//");
}

function readNextPollId(next: string) {
  const match = next.match(/^\/polls\/([^/?#]+)/);
  return match?.[1] ?? null;
}

function buildFailureRedirect(
  request: NextRequest,
  next: string | null,
  error = "1"
) {
  const url = buildRequestUrl(request, "/login");
  url.searchParams.set("error", error);

  if (next) {
    url.searchParams.set("next", next);
  }

  return url;
}

async function readLoginFields(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as
      | {
          nick?: unknown;
          password?: unknown;
          next?: unknown;
        }
      | null;

    return {
      nick: typeof body?.nick === "string" ? body.nick.trim() : "",
      password: typeof body?.password === "string" ? body.password : "",
      next: typeof body?.next === "string" ? body.next : ""
    };
  }

  const formData = await request.formData().catch(() => null);

  return {
    nick: String(formData?.get("nick") ?? "").trim(),
    password: String(formData?.get("password") ?? ""),
    next: String(formData?.get("next") ?? "")
  };
}

export async function POST(request: NextRequest) {
  const { nick, password, next } = await readLoginFields(request);
  const untrustedOrigin = rejectIfUntrustedWriteOrigin(request);

  if (untrustedOrigin) {
    return NextResponse.redirect(
      buildFailureRedirect(request, next, "forbidden_origin"),
      303
    );
  }

  if (!nick || !password) {
    return NextResponse.redirect(buildFailureRedirect(request, next), 303);
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.redirect(
      buildFailureRedirect(request, next, "service_unavailable"),
      303
    );
  }

  const user = await db.user.findUnique({
    where: { nick }
  });

  let redirectPath: string | null = null;
  const nextPollId = readNextPollId(next);

  if (user && user.status === "ACTIVE") {
    const isValidPassword = await verifyPassword(password, user.passwordHash);

    if (isValidPassword) {
      await writeSessionCookie({
        subjectType: "user",
        userId: user.id,
        nick: user.nick,
        role: user.role
      });

      redirectPath = isSafeInternalPath(next)
        ? next
        : canManagePolls(user.role)
          ? "/admin/polls"
          : "/polls";

      if (nextPollId) {
        await markPollInviteOpened({
          pollId: nextPollId,
          userId: user.id
        });
      }
    }
  }

  if (!redirectPath) {
    if (nextPollId) {
      const access = await authenticateTemporaryPollVoter({
        pollId: nextPollId,
        nick,
        password
      });

      if (access) {
        await writeSessionCookie({
          subjectType: "poll_voter_access",
          userId: "",
          pollVoterAccessId: access.id,
          pollId: access.pollId,
          nick: access.nick,
          role: "VOTER_TEMP"
        });

        await markPollInviteOpened({
          pollId: access.pollId,
          pollVoterAccessId: access.id
        });

        redirectPath = isSafeInternalPath(next) ? next : `/polls/${access.pollId}`;
      }
    }
  }

  if (!redirectPath) {
    return NextResponse.redirect(buildFailureRedirect(request, next), 303);
  }

  return NextResponse.redirect(buildRequestUrl(request, redirectPath), 303);
}
