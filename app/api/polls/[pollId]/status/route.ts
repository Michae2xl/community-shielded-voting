import { NextResponse, type NextRequest } from "next/server";
import { readSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { scheduleAutoPollReconcile } from "@/lib/services/poll-auto-reconcile";
import { receiptRecencyOrderBy } from "@/app/api/admin/polls/[pollId]/receipts/route";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ pollId: string }> }
) {
  const session = await readSession();

  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { pollId } = await context.params;
  const assignment = await db.ticketAssignment.findFirst({
    where:
      session.subjectType === "poll_voter_access"
        ? {
            pollId,
            pollVoterAccessId: session.pollVoterAccessId
          }
        : {
            pollId,
            userId: session.userId
          },
    include: {
      ticket: true
    }
  });

  const latestReceipt = assignment
    ? await db.voteReceipt.findFirst({
        where: {
          pollId,
          ticketHash: assignment.ticket.ticketHash
        },
        orderBy: receiptRecencyOrderBy,
        select: {
          status: true
        }
      })
    : null;

  if (
    assignment?.ticket.status === "ISSUED" ||
    assignment?.ticket.status === "LOCKED"
  ) {
    scheduleAutoPollReconcile(pollId);
  }

  return NextResponse.json({
    ticketStatus: assignment?.ticket.status ?? null,
    latestReceiptStatus: latestReceipt?.status ?? null
  });
}
