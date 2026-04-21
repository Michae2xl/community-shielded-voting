import { NextResponse, type NextRequest } from "next/server";
import { canManagePolls } from "@/lib/auth/guards";
import { findOwnedPoll } from "@/lib/auth/poll-ownership";
import { readSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export function mapTallyResponse(input: {
  countA: number;
  countB: number;
  countC: number;
  countD: number;
  countE: number;
  totalConfirmed: number;
}) {
  return {
    totalConfirmed: input.totalConfirmed,
    options: {
      A: input.countA,
      B: input.countB,
      C: input.countC,
      D: input.countD,
      E: input.countE
    }
  };
}

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

  const tally = await db.pollTally.findUnique({
    where: {
      pollId
    }
  });

  return NextResponse.json(
    mapTallyResponse(
      tally ?? {
        countA: 0,
        countB: 0,
        countC: 0,
        countD: 0,
        countE: 0,
        totalConfirmed: 0
      }
    )
  );
}
