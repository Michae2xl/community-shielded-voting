import { NextResponse, type NextRequest } from "next/server";
import { readSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { scheduleAutoPollReconcile } from "@/lib/services/poll-auto-reconcile";
import { hasObservedVoteForAddresses } from "@/lib/services/vote-observation";

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
      ticket: {
        select: {
          status: true,
          lockedRequestId: true,
          poll: {
            select: {
              status: true
            }
          },
          requests: {
            where: {
              status: "ACTIVE"
            }
          }
        }
      }
    }
  });

  if (
    !assignment?.ticket ||
    assignment.ticket.poll.status !== "OPEN"
  ) {
    return NextResponse.json({ requests: [] });
  }

  if (assignment.ticket.status !== "ISSUED" && assignment.ticket.status !== "LOCKED") {
    return NextResponse.json({ requests: [] });
  }

  scheduleAutoPollReconcile(pollId);

  if (
    await hasObservedVoteForAddresses(
      assignment.ticket.requests.map((request) => request.shieldedAddress)
    )
  ) {
    return NextResponse.json({ requests: [] });
  }

  if (assignment.ticket.status === "LOCKED") {
    const lockedRequest =
      assignment.ticket.requests.find(
        (request) => request.id === assignment.ticket.lockedRequestId
      ) ?? null;

    return NextResponse.json({
      requests: lockedRequest ? [lockedRequest] : []
    });
  }

  return NextResponse.json({
    requests: assignment.ticket.requests
  });
}
