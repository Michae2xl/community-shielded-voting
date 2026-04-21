import { randomUUID } from "node:crypto";
import { type OptionLetter } from "@/lib/domain/options";
import { buildTicketHash } from "@/lib/domain/tickets";
import { db } from "@/lib/db";
import { buildZip321Uri } from "@/lib/zcash/zip321";
import { ZcashConfigError, zcashMocksAllowed } from "@/lib/zcash/runtime";
import { getZkoolClient } from "@/lib/zcash/zkool-client";

function mockShieldedAddress(ticketPublicId: string, option: OptionLetter) {
  return `utest1${ticketPublicId.replace(/_/g, "").slice(0, 20)}${option.toLowerCase()}`;
}

async function allocateShieldedAddresses(
  ticketPublicId: string,
  optionLetters: OptionLetter[]
) {
  const client = getZkoolClient();

  if (!client.isConfigured()) {
    if (!zcashMocksAllowed()) {
      throw new ZcashConfigError("Zcash collector wallet is not configured");
    }

    return optionLetters.map((optionLetter) => ({
      optionLetter,
      shieldedAddress: mockShieldedAddress(ticketPublicId, optionLetter)
    }));
  }

  const addresses = await Promise.all(
    optionLetters.map(async (optionLetter) => ({
      optionLetter,
      shieldedAddress: await client.allocateVoteAddress()
    }))
  );

  return addresses;
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

function isUserTicketSubject(subject: TicketSubject): subject is UserTicketSubject {
  return "userId" in subject;
}

function buildAssignmentWhere(pollId: string, subject: TicketSubject) {
  return isUserTicketSubject(subject)
    ? {
        pollId,
        userId: subject.userId
      }
    : {
        pollId,
        pollVoterAccessId: subject.pollVoterAccessId
      };
}

function buildAssignmentCreate(subject: TicketSubject) {
  return isUserTicketSubject(subject)
    ? {
        userId: subject.userId
      }
    : {
        pollVoterAccessId: subject.pollVoterAccessId
      };
}

async function readIssuedTicketForSubject(pollId: string, subject: TicketSubject) {
  const assignment = await db.ticketAssignment.findFirst({
    where: buildAssignmentWhere(pollId, subject),
    include: {
      ticket: {
        include: {
          requests: true
        }
      }
    }
  });

  return assignment?.ticket ?? null;
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export async function issueTicketForVoter(
  input: TicketSubject & {
    pollId: string;
    feeZec: string;
    optionLetters: OptionLetter[];
  }
) {
  const subject: TicketSubject = isUserTicketSubject(input)
    ? { userId: input.userId }
    : { pollVoterAccessId: input.pollVoterAccessId };

  const existingTicket = await readIssuedTicketForSubject(input.pollId, subject);

  if (existingTicket) {
    return existingTicket;
  }

  const ticketPublicId = `ticket_${randomUUID()}`;
  const ticketSecret = `secret_${randomUUID()}`;
  const ticketHash = buildTicketHash(ticketPublicId, ticketSecret);
  const requestAddresses = await allocateShieldedAddresses(
    ticketPublicId,
    input.optionLetters
  );

  try {
    await db.$transaction(async (tx) => {
      const ticket = await tx.voteTicket.create({
        data: {
          pollId: input.pollId,
          ticketPublicId,
          ticketHash,
          assignment: {
            create: buildAssignmentCreate(subject)
          }
        }
      });

      await tx.voteRequest.createMany({
        data: requestAddresses.map(({ optionLetter, shieldedAddress }) => {
          return {
            ticketId: ticket.id,
            optionLetter,
            shieldedAddress,
            zip321Uri: buildZip321Uri({
              address: shieldedAddress,
              amountZec: input.feeZec,
              memo: optionLetter
            })
          };
        })
      });
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const ticket = await readIssuedTicketForSubject(input.pollId, subject);

      if (ticket) {
        return ticket;
      }
    }

    throw error;
  }

  const ticket = await readIssuedTicketForSubject(input.pollId, subject);

  if (!ticket) {
    throw new Error("ticket issuance failed");
  }

  return ticket;
}

export async function issueTicketForUser(input: {
  pollId: string;
  userId: string;
  feeZec: string;
  optionLetters: OptionLetter[];
}) {
  return issueTicketForVoter(input);
}
