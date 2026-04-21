import { PollStatus, TicketStatus, VoteRequestStatus } from "@prisma/client";
import { db } from "@/lib/db";

export type PollLifecycleTransition =
  | "NONE"
  | "SCHEDULED_TO_OPEN"
  | "SCHEDULED_TO_CLOSED"
  | "OPEN_TO_CLOSED";

export async function syncPollLifecycleForPoll(
  pollId: string,
  now = new Date()
) {
  const poll = await db.poll.findUnique({
    where: { id: pollId },
    select: {
      id: true,
      status: true,
      opensAt: true,
      closesAt: true
    }
  });

  if (!poll) {
    return null;
  }

  let nextStatus = poll.status;
  let transition: PollLifecycleTransition = "NONE";

  if (
    poll.status === PollStatus.SCHEDULED &&
    poll.closesAt.getTime() <= now.getTime()
  ) {
    nextStatus = PollStatus.CLOSED;
    transition = "SCHEDULED_TO_CLOSED";
  } else if (
    poll.status === PollStatus.SCHEDULED &&
    poll.opensAt.getTime() <= now.getTime()
  ) {
    nextStatus = PollStatus.OPEN;
    transition = "SCHEDULED_TO_OPEN";
  } else if (
    poll.status === PollStatus.OPEN &&
    poll.closesAt.getTime() <= now.getTime()
  ) {
    nextStatus = PollStatus.CLOSED;
    transition = "OPEN_TO_CLOSED";
  }

  if (nextStatus === poll.status) {
    return {
      pollId: poll.id,
      previousStatus: poll.status,
      status: poll.status,
      transition
    };
  }

  await db.$transaction(async (tx) => {
    await tx.poll.update({
      where: { id: poll.id },
      data: {
        status: nextStatus
      }
    });

    if (nextStatus === PollStatus.CLOSED) {
      await tx.voteTicket.updateMany({
        where: {
          pollId: poll.id,
          status: {
            in: [TicketStatus.ISSUED, TicketStatus.LOCKED]
          }
        },
        data: {
          status: TicketStatus.EXPIRED
        }
      });

      await tx.voteRequest.updateMany({
        where: {
          ticket: {
            pollId: poll.id
          },
          status: VoteRequestStatus.ACTIVE
        },
        data: {
          status: VoteRequestStatus.EXPIRED
        }
      });
    }
  });

  return {
    pollId: poll.id,
    previousStatus: poll.status,
    status: nextStatus,
    transition
  };
}

export async function syncAllPollLifecycles(now = new Date()) {
  const polls = await db.poll.findMany({
    where: {
      status: {
        in: [PollStatus.SCHEDULED, PollStatus.OPEN]
      }
    },
    select: {
      id: true
    }
  });

  let opened = 0;
  let closed = 0;
  const results = [];

  for (const poll of polls) {
    const result = await syncPollLifecycleForPoll(poll.id, now);

    if (!result) {
      continue;
    }

    if (result.transition === "SCHEDULED_TO_OPEN") {
      opened += 1;
    }

    if (
      result.transition === "SCHEDULED_TO_CLOSED" ||
      result.transition === "OPEN_TO_CLOSED"
    ) {
      closed += 1;
    }

    results.push(result);
  }

  return {
    processed: results.length,
    opened,
    closed,
    results
  };
}
