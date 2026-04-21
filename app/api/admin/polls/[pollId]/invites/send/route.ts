import { NextResponse, type NextRequest } from "next/server";
import { canManagePolls } from "@/lib/auth/guards";
import { creatorOwnsPoll } from "@/lib/auth/poll-ownership";
import { readSession } from "@/lib/auth/session";
import { getRequestOrigin } from "@/lib/http/request-url";
import { rejectIfUntrustedWriteOrigin } from "@/lib/http/write-origin";
import {
  InviteServiceError,
  sendPollInvites
} from "@/lib/services/poll-invites";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ pollId: string }> }
) {
  const untrustedOrigin = rejectIfUntrustedWriteOrigin(request);

  if (untrustedOrigin) {
    return untrustedOrigin;
  }

  const session = await readSession();

  if (!session || !canManagePolls(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { pollId } = await context.params;
  const ownsPoll = await creatorOwnsPoll(pollId, session.userId);

  if (!ownsPoll) {
    return NextResponse.json({ error: "POLL_NOT_FOUND" }, { status: 404 });
  }

  const baseUrl = process.env.APP_BASE_URL || getRequestOrigin(request);

  try {
    const result = await sendPollInvites({
      pollId,
      baseUrl
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof InviteServiceError) {
      return NextResponse.json(
        {
          error: error.code,
          details: error.details
        },
        { status: error.status }
      );
    }

    throw error;
  }
}
