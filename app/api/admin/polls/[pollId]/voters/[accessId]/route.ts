import { NextResponse, type NextRequest } from "next/server";
import { canManagePolls } from "@/lib/auth/guards";
import { creatorOwnsPoll } from "@/lib/auth/poll-ownership";
import { readSession } from "@/lib/auth/session";
import { rejectIfUntrustedWriteOrigin } from "@/lib/http/write-origin";
import {
  PollVoterAccessServiceError,
  removePendingPollVoterAccess
} from "@/lib/services/poll-voter-access";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ pollId: string; accessId: string }> }
) {
  const untrustedOrigin = rejectIfUntrustedWriteOrigin(request);

  if (untrustedOrigin) {
    return untrustedOrigin;
  }

  const session = await readSession();

  if (!session || !canManagePolls(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const { pollId, accessId } = await context.params;
    const ownsPoll = await creatorOwnsPoll(pollId, session.userId);

    if (!ownsPoll) {
      return NextResponse.json({ error: "POLL_NOT_FOUND" }, { status: 404 });
    }

    await removePendingPollVoterAccess({
      pollId,
      pollVoterAccessId: accessId
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PollVoterAccessServiceError) {
      return NextResponse.json(
        { error: error.code, details: error.details },
        { status: error.status }
      );
    }

    throw error;
  }
}
