import type { OptionLetter } from "@/lib/domain/options";
import { db } from "@/lib/db";

export class TicketLockingError extends Error {
  constructor(
    message: string,
    public readonly status: 404 | 409,
    public readonly code:
      | "TICKET_NOT_FOUND"
      | "TICKET_NOT_ISSUABLE"
      | "REQUEST_NOT_FOUND"
      | "TICKET_LOCK_CONFLICT"
  ) {
    super(message);
    this.name = "TicketLockingError";
  }
}

type UserTicketSubject = {
  userId: string;
  pollVoterAccessId?: never;
};

type PollVoterAccessTicketSubject = {
  userId?: never;
  pollVoterAccessId: string;
};

type TicketSubject = UserTicketSubject | PollVoterAccessTicketSubject;

function buildAssignmentWhere(pollId: string, subject: TicketSubject) {
  return "userId" in subject
    ? {
        pollId,
        userId: subject.userId
      }
    : {
        pollId,
        pollVoterAccessId: subject.pollVoterAccessId
      };
}

export async function lockTicketChoice(
  input: TicketSubject & {
    pollId: string;
    optionLetter: OptionLetter;
  }
) {
  const lockedAt = new Date();

  return db.$transaction(async (tx) => {
    const assignment = await tx.ticketAssignment.findFirst({
      where: buildAssignmentWhere(input.pollId, input),
      include: {
        ticket: {
          include: {
            requests: true
          }
        }
      }
    });

    const ticket = assignment?.ticket;

    if (!ticket) {
      throw new TicketLockingError("ticket not found", 404, "TICKET_NOT_FOUND");
    }

    if (ticket.status !== "ISSUED") {
      throw new TicketLockingError(
        "ticket is no longer issuable",
        409,
        "TICKET_NOT_ISSUABLE"
      );
    }

    const lockedRequest = ticket.requests.find(
      (request) =>
        request.optionLetter === input.optionLetter && request.status === "ACTIVE"
    );

    if (!lockedRequest) {
      throw new TicketLockingError("request not found", 404, "REQUEST_NOT_FOUND");
    }

    const updated = await tx.voteTicket.updateMany({
      where: {
        id: ticket.id,
        status: "ISSUED",
        lockedRequestId: null
      },
      data: {
        status: "LOCKED",
        lockedOptionLetter: input.optionLetter,
        lockedRequestId: lockedRequest.id,
        lockedAt
      }
    });

    if (updated.count !== 1) {
      throw new TicketLockingError(
        "ticket lock conflict",
        409,
        "TICKET_LOCK_CONFLICT"
      );
    }

    await tx.voteRequest.updateMany({
      where: {
        ticketId: ticket.id,
        status: "ACTIVE",
        id: {
          not: lockedRequest.id
        }
      },
      data: {
        status: "EXPIRED"
      }
    });

    return {
      ticketId: ticket.id,
      pollId: ticket.pollId,
      status: "LOCKED" as const,
      lockedOptionLetter: input.optionLetter,
      lockedRequestId: lockedRequest.id,
      lockedAt,
      lockedRequest
    };
  });
}
