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
        include: {
          requests: {
            select: {
              id: true,
              optionLetter: true,
              shieldedAddress: true,
              zip321Uri: true,
              status: true
            }
          }
        }
      }
    }
  });

  const ticket = assignment?.ticket;
  const confirmedReceipt = ticket
    ? await db.voteReceipt.findFirst({
        where: {
          pollId,
          ticketHash: ticket.ticketHash,
          status: "CONFIRMED"
        },
        select: {
          receiptPublicId: true,
          txid: true,
          confirmedAt: true
        }
      })
    : null;
  const observedVote =
    ticket && (ticket.status === "ISSUED" || ticket.status === "LOCKED")
      ? await hasObservedVoteForAddresses(
          ticket.requests?.map((request) => request.shieldedAddress) ?? []
        )
      : false;

  if (ticket && (ticket.status === "ISSUED" || ticket.status === "LOCKED")) {
    scheduleAutoPollReconcile(pollId);
  }

  return NextResponse.json({
    ticket: ticket
      ? {
          id: ticket.id,
          pollId: ticket.pollId,
          ticketPublicId: ticket.ticketPublicId,
          status: ticket.status,
          observedVote,
          lockedOptionLetter: ticket.lockedOptionLetter,
          lockedRequestId: ticket.lockedRequestId,
          lockedAt: ticket.lockedAt?.toISOString() ?? null,
          lockedRequest:
            ticket.lockedRequestId
              ? ticket.requests.find((request) => request.id === ticket.lockedRequestId) ??
                null
              : null,
          receipt: confirmedReceipt
            ? {
                receiptPublicId: confirmedReceipt.receiptPublicId,
                txid: confirmedReceipt.txid,
                confirmedAt: confirmedReceipt.confirmedAt?.toISOString() ?? null
              }
            : null,
          issuedAt: ticket.issuedAt.toISOString(),
          expiresAt: ticket.expiresAt?.toISOString() ?? null
        }
      : null
  });
}
