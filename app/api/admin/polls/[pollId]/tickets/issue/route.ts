import { NextResponse, type NextRequest } from "next/server";
import { canManagePolls } from "@/lib/auth/guards";
import { findOwnedPoll } from "@/lib/auth/poll-ownership";
import { getActiveOptionLetters } from "@/lib/domain/options";
import { readSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { rejectIfUntrustedWriteOrigin } from "@/lib/http/write-origin";
import { issueTicketForVoter } from "@/lib/services/tickets";
import { ZcashConfigError } from "@/lib/zcash/runtime";

function formatZatToZec(value: bigint) {
  const digits = value.toString().padStart(9, "0");
  const whole = digits.slice(0, -8) || "0";
  const fraction = digits.slice(-8).replace(/0+$/g, "");

  return fraction ? `${whole}.${fraction}` : whole;
}

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
  const poll = await findOwnedPoll(pollId, session.userId, {
    id: true,
    feeZat: true,
    optionALabel: true,
    optionBLabel: true,
    optionCLabel: true,
    optionDLabel: true,
    optionELabel: true
  });

  if (!poll) {
    return NextResponse.json({ error: "POLL_NOT_FOUND" }, { status: 404 });
  }

  const eligibleUsers = await db.pollEligibility.findMany({
    where: {
      pollId
    },
    select: {
      userId: true
    }
  });

  const temporaryVoters = await db.pollVoterAccess.findMany({
    where: {
      pollId,
      status: "ACTIVE"
    },
    select: {
      id: true
    }
  });

  const existingAssignments = await db.ticketAssignment.findMany({
    where: {
      pollId
    },
    select: {
      userId: true,
      pollVoterAccessId: true
    }
  });

  const existingUserIds = new Set(
    existingAssignments
      .map((row) => row.userId)
      .filter((value): value is string => Boolean(value))
  );
  const existingPollVoterAccessIds = new Set(
    existingAssignments
      .map((row) => row.pollVoterAccessId)
      .filter((value): value is string => Boolean(value))
  );
  let issued = 0;
  const optionLetters = getActiveOptionLetters(poll);

  for (const row of eligibleUsers) {
    if (existingUserIds.has(row.userId)) {
      continue;
    }

    try {
      await issueTicketForVoter({
        pollId,
        userId: row.userId,
        feeZec: formatZatToZec(poll.feeZat),
        optionLetters
      });
    } catch (error) {
      if (error instanceof ZcashConfigError) {
        return NextResponse.json(
          { error: "ZCASH_NOT_CONFIGURED" },
          { status: 503 }
        );
      }

      throw error;
    }
    issued += 1;
  }

  for (const access of temporaryVoters) {
    if (existingPollVoterAccessIds.has(access.id)) {
      continue;
    }

    try {
      await issueTicketForVoter({
        pollId,
        pollVoterAccessId: access.id,
        feeZec: formatZatToZec(poll.feeZat),
        optionLetters
      });
    } catch (error) {
      if (error instanceof ZcashConfigError) {
        return NextResponse.json(
          { error: "ZCASH_NOT_CONFIGURED" },
          { status: 503 }
        );
      }

      throw error;
    }
    issued += 1;
  }

  return NextResponse.json({ issued });
}
