import { NextResponse, type NextRequest } from "next/server";
import { canManagePolls } from "@/lib/auth/guards";
import { creatorOwnsPoll } from "@/lib/auth/poll-ownership";
import { readSession } from "@/lib/auth/session";
import { rejectIfUntrustedWriteOrigin } from "@/lib/http/write-origin";
import { reconcilePollVotes } from "@/lib/services/poll-reconcile";
import { syncPollLifecycleForPoll } from "@/lib/services/poll-lifecycle";
import { getZkoolClient } from "@/lib/zcash/zkool-client";

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

  await syncPollLifecycleForPoll(pollId);
  await getZkoolClient().syncWallet();

  const result = await reconcilePollVotes(pollId);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json(result);
}
