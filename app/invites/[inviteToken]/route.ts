import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { readSession, writeSessionCookie } from "@/lib/auth/session";
import { buildRequestUrl } from "@/lib/http/request-url";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ inviteToken: string }> }
) {
  const { inviteToken } = await context.params;
  const invite = await db.pollInvite.findUnique({
    where: {
      inviteToken
    },
    select: {
      id: true,
      pollId: true,
      openedAt: true,
      userId: true,
      pollVoterAccessId: true,
      pollVoterAccess: {
        select: {
          id: true,
          pollId: true,
          nick: true,
          status: true,
          expiresAt: true
        }
      }
    }
  });

  if (!invite) {
    return NextResponse.json({ error: "INVITE_NOT_FOUND" }, { status: 404 });
  }

  if (invite.pollVoterAccessId) {
    const access = invite.pollVoterAccess;

    if (
      !access ||
      access.status !== "ACTIVE" ||
      access.expiresAt.getTime() <= Date.now()
    ) {
      return NextResponse.json({ error: "INVITE_EXPIRED" }, { status: 410 });
    }

    if (invite.openedAt) {
      const session = await readSession();

      if (
        session?.subjectType === "poll_voter_access" &&
        session.pollVoterAccessId === access.id
      ) {
        return NextResponse.redirect(buildRequestUrl(request, `/polls/${invite.pollId}`));
      }
    }

    const opened = await db.pollInvite.updateMany({
      where: {
        id: invite.id,
        openedAt: null
      },
      data: {
        status: "OPENED",
        openedAt: new Date(),
        lastError: null
      }
    });

    if (opened.count !== 1) {
      return NextResponse.json({ error: "INVITE_ALREADY_USED" }, { status: 410 });
    }

    await db.pollVoterAccess.update({
      where: {
        id: access.id
      },
      data: {
        lastLoginAt: new Date()
      }
    });

    await writeSessionCookie({
      subjectType: "poll_voter_access",
      userId: "",
      pollVoterAccessId: access.id,
      pollId: access.pollId,
      nick: access.nick,
      role: "VOTER_TEMP"
    });

    return NextResponse.redirect(buildRequestUrl(request, `/polls/${invite.pollId}`));
  }

  const redirectUrl = buildRequestUrl(request, "/login");
  redirectUrl.searchParams.set("next", `/polls/${invite.pollId}`);

  return NextResponse.redirect(redirectUrl);
}
