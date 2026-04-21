import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
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
      pollVoterAccessId: true
    }
  });

  if (!invite) {
    return NextResponse.json({ error: "INVITE_NOT_FOUND" }, { status: 404 });
  }

  const redirectUrl = buildRequestUrl(request, "/login");
  redirectUrl.searchParams.set("next", `/polls/${invite.pollId}`);

  return NextResponse.redirect(redirectUrl);
}
