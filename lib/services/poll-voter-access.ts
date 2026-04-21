import { randomBytes } from "node:crypto";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { generateInviteToken } from "@/lib/domain/invites";

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PASSWORD_GROUP_SIZE = 4;
const PASSWORD_GROUP_COUNT = 3;

function buildTemporaryPassword() {
  const raw = randomBytes(PASSWORD_GROUP_SIZE * PASSWORD_GROUP_COUNT);
  const chars = Array.from(raw, (byte) => PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length]);

  const groups = [];

  for (let index = 0; index < chars.length; index += PASSWORD_GROUP_SIZE) {
    groups.push(chars.slice(index, index + PASSWORD_GROUP_SIZE).join(""));
  }

  return groups.join("-");
}

export class PollVoterAccessServiceError extends Error {
  constructor(
    message: string,
    public readonly status: 404 | 409,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "PollVoterAccessServiceError";
  }
}

export async function issueTemporaryPollPassword(input: {
  pollVoterAccessId: string;
}) {
  const plaintextPassword = buildTemporaryPassword();
  const passwordHash = await hashPassword(plaintextPassword);

  await db.pollVoterAccess.update({
    where: { id: input.pollVoterAccessId },
    data: {
      passwordHash,
      passwordIssuedAt: new Date(),
      status: "ACTIVE"
    }
  });

  return { plaintextPassword };
}

export async function createPollVoterAccesses(input: {
  pollId: string;
  voters: Array<{ nick: string; email: string }>;
}) {
  const poll = await db.poll.findUnique({
    where: { id: input.pollId },
    select: {
      id: true,
      closesAt: true
    }
  });

  if (!poll) {
    throw new PollVoterAccessServiceError(
      "poll not found",
      404,
      "POLL_NOT_FOUND"
    );
  }

  const created = [];

  for (const voter of input.voters) {
    try {
      const access = await db.pollVoterAccess.create({
        data: {
          pollId: poll.id,
          nick: voter.nick,
          email: voter.email,
          inviteToken: generateInviteToken(),
          expiresAt: poll.closesAt
        },
        select: {
          id: true,
          nick: true,
          email: true
        }
      });

      created.push(access);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: unknown }).code === "P2002"
      ) {
        throw new PollVoterAccessServiceError(
          "duplicate voter",
          409,
          "DUPLICATE_VOTER",
          {
            nick: voter.nick,
            email: voter.email
          }
        );
      }

      throw error;
    }
  }

  return created;
}

export async function removePendingPollVoterAccess(input: {
  pollId: string;
  pollVoterAccessId: string;
}) {
  const access = await db.pollVoterAccess.findUnique({
    where: {
      id: input.pollVoterAccessId
    },
    select: {
      id: true,
      pollId: true,
      invites: {
        select: {
          id: true
        }
      },
      assignments: {
        select: {
          ticketId: true
        }
      }
    }
  });

  if (!access || access.pollId !== input.pollId) {
    throw new PollVoterAccessServiceError(
      "voter not found",
      404,
      "POLL_VOTER_NOT_FOUND"
    );
  }

  if (access.invites.length || access.assignments.length) {
    throw new PollVoterAccessServiceError(
      "voter already invited",
      409,
      "VOTER_ALREADY_INVITED"
    );
  }

  await db.pollVoterAccess.delete({
    where: {
      id: access.id
    }
  });
}

export async function authenticateTemporaryPollVoter(input: {
  pollId: string;
  nick: string;
  password: string;
}) {
  const access = await db.pollVoterAccess.findUnique({
    where: {
      pollId_nick: {
        pollId: input.pollId,
        nick: input.nick
      }
    }
  });

  if (
    !access ||
    access.status !== "ACTIVE" ||
    !access.passwordHash ||
    access.expiresAt.getTime() <= Date.now()
  ) {
    return null;
  }

  const authenticated = await verifyPassword(input.password, access.passwordHash);

  if (!authenticated) {
    return null;
  }

  return access;
}
