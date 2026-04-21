import { NextResponse, type NextRequest } from "next/server";
import { canManagePolls } from "@/lib/auth/guards";
import { findOwnedPoll } from "@/lib/auth/poll-ownership";
import { readSession } from "@/lib/auth/session";
import { scheduleAutoPollReconcile } from "@/lib/services/poll-auto-reconcile";
import { readPollCollectorTally } from "@/lib/services/collector-tally";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ pollId: string }> }
) {
  const session = await readSession();

  if (!session || !canManagePolls(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { pollId } = await context.params;
  const poll = await findOwnedPoll(pollId, session.userId, { id: true });

  if (!poll) {
    return NextResponse.json({ error: "POLL_NOT_FOUND" }, { status: 404 });
  }

  const tally = await readPollCollectorTally(pollId);
  scheduleAutoPollReconcile(pollId);

  return NextResponse.json({
    summary: {
      totalConfirmed: tally.totalConfirmed,
      options: tally.counts
    }
  });
}
