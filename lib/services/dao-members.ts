import {
  DaoMembershipActionStatus,
  DaoMembershipActionType,
  DaoMemberStatus
} from "@prisma/client";
import { db } from "@/lib/db";
import {
  calculateSingleChoiceOutcome,
  presentGovernanceOutcome
} from "@/lib/domain/governance";
import type { PollVoterInput } from "@/lib/domain/poll-voters";
import { normalizeSignalUsername } from "@/lib/domain/signal";

export class DaoMemberServiceError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 404 | 409,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "DaoMemberServiceError";
  }
}

function normalizeDaoMemberInput(voter: PollVoterInput) {
  return {
    nick: voter.nick.trim(),
    signalUsername: normalizeSignalUsername(voter.signalUsername)
  };
}

export async function readActiveDaoMemberVoters() {
  const members = await db.daoMember.findMany({
    where: {
      status: DaoMemberStatus.ACTIVE
    },
    orderBy: {
      nick: "asc"
    },
    select: {
      nick: true,
      signalUsername: true
    }
  });

  return members;
}

export async function bootstrapDaoMemberBasket(input: {
  voters: PollVoterInput[];
}) {
  const normalized = input.voters.map(normalizeDaoMemberInput);
  const seenNicks = new Set<string>();
  const seenSignalUsernames = new Set<string>();

  for (const voter of normalized) {
    if (!voter.nick || !voter.signalUsername) {
      throw new DaoMemberServiceError(
        "DAO member rows require nick and Signal username",
        400,
        "INVALID_DAO_MEMBER_INPUT"
      );
    }

    if (
      seenNicks.has(voter.nick) ||
      seenSignalUsernames.has(voter.signalUsername)
    ) {
      throw new DaoMemberServiceError(
        "duplicate DAO member",
        400,
        "DUPLICATE_DAO_MEMBER"
      );
    }

    seenNicks.add(voter.nick);
    seenSignalUsernames.add(voter.signalUsername);
  }

  if (normalized.length === 0) {
    throw new DaoMemberServiceError(
      "DAO member basket requires at least one member",
      400,
      "DAO_MEMBER_BASKET_EMPTY"
    );
  }

  return db.$transaction(async (tx) => {
    const existingCount = await tx.daoMember.count();

    if (existingCount > 0) {
      throw new DaoMemberServiceError(
        "DAO member basket is already initialized",
        409,
        "DAO_MEMBER_BOOTSTRAP_LOCKED"
      );
    }

    await tx.daoMember.createMany({
      data: normalized.map((voter) => ({
        nick: voter.nick,
        signalUsername: voter.signalUsername,
        status: DaoMemberStatus.ACTIVE
      }))
    });

    return tx.daoMember.findMany({
      orderBy: {
        nick: "asc"
      },
      select: {
        id: true,
        nick: true,
        signalUsername: true,
        status: true
      }
    });
  });
}

export async function applyDaoMembershipActionForPoll(pollId: string) {
  const poll = await db.poll.findUnique({
    where: {
      id: pollId
    },
    select: {
      id: true,
      status: true,
      voteModel: true,
      quorumPercent: true,
      passingThresholdPercent: true,
      tally: {
        select: {
          totalConfirmed: true,
          countA: true
        }
      },
      _count: {
        select: {
          eligibility: true,
          voterAccesses: true
        }
      },
      membershipAction: {
        select: {
          id: true,
          type: true,
          status: true,
          nick: true,
          signalUsername: true,
          targetMemberId: true
        }
      }
    }
  });

  const action = poll?.membershipAction;

  if (!poll || !action || action.status !== DaoMembershipActionStatus.PENDING) {
    return null;
  }

  const closed =
    poll.status === "CLOSED" ||
    poll.status === "FINALIZED" ||
    poll.status === "ARCHIVED";
  const totalEligible = poll._count.eligibility + poll._count.voterAccesses;
  const totalConfirmed = poll.tally?.totalConfirmed ?? 0;
  const countA = poll.tally?.countA ?? 0;
  const outcome = calculateSingleChoiceOutcome({
    isClosed: closed,
    totalEligible,
    totalConfirmed,
    countA,
    voteModel: poll.voteModel,
    quorumPercent: poll.quorumPercent,
    passingThresholdPercent: poll.passingThresholdPercent
  });

  if (outcome.outcome === "PENDING") {
    return {
      pollId,
      actionId: action.id,
      status: DaoMembershipActionStatus.PENDING,
      outcome: presentGovernanceOutcome(outcome.outcome)
    };
  }

  if (outcome.outcome !== "PASSED") {
    await db.daoMembershipAction.update({
      where: {
        id: action.id
      },
      data: {
        status: DaoMembershipActionStatus.REJECTED
      }
    });

    return {
      pollId,
      actionId: action.id,
      status: DaoMembershipActionStatus.REJECTED,
      outcome: presentGovernanceOutcome(outcome.outcome)
    };
  }

  await db.$transaction(async (tx) => {
    if (action.type === DaoMembershipActionType.ADD_MEMBER) {
      const existing = await tx.daoMember.findFirst({
        where: {
          OR: [{ signalUsername: action.signalUsername }, { nick: action.nick }]
        },
        select: {
          id: true
        }
      });

      if (existing) {
        await tx.daoMember.update({
          where: {
            id: existing.id
          },
          data: {
            nick: action.nick,
            signalUsername: action.signalUsername,
            status: DaoMemberStatus.ACTIVE,
            addedByPollId: pollId,
            removedByPollId: null
          }
        });
      } else {
        await tx.daoMember.create({
          data: {
            nick: action.nick,
            signalUsername: action.signalUsername,
            status: DaoMemberStatus.ACTIVE,
            addedByPollId: pollId
          }
        });
      }
    } else {
      await tx.daoMember.updateMany({
        where: {
          status: DaoMemberStatus.ACTIVE,
          OR: action.targetMemberId
            ? [
                { id: action.targetMemberId },
                { signalUsername: action.signalUsername }
              ]
            : [{ signalUsername: action.signalUsername }]
        },
        data: {
          status: DaoMemberStatus.REMOVED,
          removedByPollId: pollId
        }
      });
    }

    await tx.daoMembershipAction.update({
      where: {
        id: action.id
      },
      data: {
        status: DaoMembershipActionStatus.APPLIED,
        appliedAt: new Date()
      }
    });
  });

  return {
    pollId,
    actionId: action.id,
    status: DaoMembershipActionStatus.APPLIED,
    outcome: presentGovernanceOutcome(outcome.outcome)
  };
}
