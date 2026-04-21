import { NextResponse, type NextRequest } from "next/server";
import { canManagePolls } from "@/lib/auth/guards";
import { creatorOwnsPoll } from "@/lib/auth/poll-ownership";
import { readSession } from "@/lib/auth/session";
import { rejectIfUntrustedWriteOrigin } from "@/lib/http/write-origin";
import {
  PollServiceError,
  buildAndStoreAnchorMemo,
  markPollAnchoring,
  releasePollAnchoring
} from "@/lib/services/polls";
import {
  AnchorClientError,
  getAnchorClient,
  type AnchorResult
} from "@/lib/zcash/anchor-client";
import { ZcashConfigError } from "@/lib/zcash/runtime";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ pollId: string }> }
) {
  try {
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

    const memo = await buildAndStoreAnchorMemo(pollId);
    let anchor: AnchorResult;

    try {
      anchor = await getAnchorClient().anchorPoll(memo);
    } catch (error) {
      if (error instanceof ZcashConfigError) {
        await releasePollAnchoring(pollId);
        return NextResponse.json(
          { error: "ZCASH_NOT_CONFIGURED" },
          { status: 503 }
        );
      }

      if (
        error instanceof AnchorClientError &&
        error.kind === "SAFE_PRE_SUBMISSION_FAILURE"
      ) {
        await releasePollAnchoring(pollId);
        return NextResponse.json(
          { error: "ANCHOR_FAILED", kind: error.kind },
          { status: 502 }
        );
      }

      return NextResponse.json(
        { error: "ANCHOR_UNKNOWN_STATE" },
        { status: 502 }
      );
    }

    await markPollAnchoring(pollId, anchor.txid);
    return NextResponse.json(anchor);
  } catch (error) {
    if (error instanceof PollServiceError) {
      return NextResponse.json(
        { error: error.code, details: error.details },
        { status: error.status }
      );
    }

    throw error;
  }
}
