import { PollStatus } from "@prisma/client";
import { z } from "zod";
import { buildAnchorMemo, normalizeQuestion, questionHash } from "@/lib/domain/polls";
import { generateInviteToken } from "@/lib/domain/invites";
import { getDefaultPollFeeZat } from "@/lib/config/polls";
import { db } from "@/lib/db";
import { normalizeOptionLabel } from "@/lib/domain/options";
import {
  DEFAULT_PASSING_THRESHOLD_PERCENT,
  DEFAULT_QUORUM_PERCENT,
  DEFAULT_VOTE_MODEL
} from "@/lib/domain/governance";
import { MIN_POLL_WINDOW_HOURS, MIN_POLL_WINDOW_MS } from "@/lib/domain/poll-window";
import { recordPollCreatedAuditEvent } from "@/lib/services/public-audit-events";

export class PollServiceError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 404 | 409,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "PollServiceError";
  }
}

export const pollVoterInputSchema = z.object({
  nick: z.string().trim().min(1),
  email: z.string().trim().email().transform((value) => value.toLowerCase())
});

export const createDraftPollInputSchema = z
  .object({
    question: z.string().min(12),
    opensAt: z.string().datetime(),
    closesAt: z.string().datetime(),
    optionALabel: z.string().min(1),
    optionBLabel: z.string().min(1),
    optionCLabel: z.string().optional().default(""),
    optionDLabel: z.string().optional().default(""),
    optionELabel: z.string().optional().default(""),
    voters: z.array(pollVoterInputSchema).min(1)
  })
  .superRefine((value, ctx) => {
    const opensAtMs = new Date(value.opensAt).getTime();
    const closesAtMs = new Date(value.closesAt).getTime();

    if (closesAtMs <= opensAtMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["closesAt"],
        message: "closesAt must be after opensAt"
      });
    } else if (closesAtMs - opensAtMs < MIN_POLL_WINDOW_MS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["closesAt"],
        message: `Poll window must be at least ${MIN_POLL_WINDOW_HOURS} hours for global voters`
      });
    }

    const seenNicks = new Set<string>();
    const seenEmails = new Set<string>();

    value.voters.forEach((voter, index) => {
      if (seenNicks.has(voter.nick) || seenEmails.has(voter.email)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["voters", index],
          message: "duplicate voter"
        });
        return;
      }

      seenNicks.add(voter.nick);
      seenEmails.add(voter.email);
    });

    if (normalizeOptionLabel(value.optionDLabel) || normalizeOptionLabel(value.optionELabel)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["optionDLabel"],
        message: "single-choice polls support A/B and optional C abstain only"
      });
    }
  })
  .transform((value) => {
    const question = normalizeQuestion(value.question);
    const optionALabel = normalizeOptionLabel(value.optionALabel);
    const optionBLabel = normalizeOptionLabel(value.optionBLabel);
    const optionCLabel = normalizeOptionLabel(value.optionCLabel);
    const optionDLabel = normalizeOptionLabel(value.optionDLabel);
    const optionELabel = normalizeOptionLabel(value.optionELabel);
    const optionLabels = [
      optionALabel,
      optionBLabel,
      optionCLabel,
      optionDLabel,
      optionELabel
    ].filter(Boolean);

    return {
      ...value,
      question,
      optionALabel,
      optionBLabel,
      optionCLabel: optionCLabel || undefined,
      optionDLabel: optionDLabel || undefined,
      optionELabel: optionELabel || undefined,
      questionHash: questionHash(question, optionLabels)
    };
  });

export async function createDraftPoll(
  input: z.input<typeof createDraftPollInputSchema>,
  createdById: string
) {
  const parsed = createDraftPollInputSchema.parse(input);

  return db.poll.create({
    data: {
      question: parsed.question,
      optionALabel: parsed.optionALabel,
      optionBLabel: parsed.optionBLabel,
      optionCLabel: parsed.optionCLabel,
      optionDLabel: parsed.optionDLabel,
      optionELabel: parsed.optionELabel,
      voteModel: DEFAULT_VOTE_MODEL,
      quorumPercent: DEFAULT_QUORUM_PERCENT,
      passingThresholdPercent: DEFAULT_PASSING_THRESHOLD_PERCENT,
      questionHash: parsed.questionHash,
      feeZat: getDefaultPollFeeZat(),
      opensAt: new Date(parsed.opensAt),
      closesAt: new Date(parsed.closesAt),
      createdById,
      voterAccesses: {
        create: parsed.voters.map((voter) => ({
          nick: voter.nick,
          email: voter.email,
          inviteToken: generateInviteToken(),
          expiresAt: new Date(parsed.closesAt)
        }))
      },
      tally: {
        create: {}
      }
    }
  });
}

export async function buildAndStoreAnchorMemo(pollId: string) {
  const poll = await db.poll.findUnique({
    where: { id: pollId }
  });

  if (!poll) {
    throw new PollServiceError("poll not found", 404, "POLL_NOT_FOUND");
  }

  if (poll.status !== PollStatus.DRAFT) {
    throw new PollServiceError(
      "poll must be draft before anchoring",
      409,
      "POLL_NOT_DRAFT"
    );
  }

  const started = await db.poll.updateMany({
    where: {
      id: pollId,
      status: PollStatus.DRAFT
    },
    data: {
      status: PollStatus.ANCHORING
    }
  });

  if (started.count !== 1) {
    throw new PollServiceError(
      "poll must be draft before anchoring",
      409,
      "POLL_NOT_DRAFT"
    );
  }

  return buildAnchorMemo({
    pollId: poll.id,
    questionHash: poll.questionHash,
    opensAt: poll.opensAt.toISOString(),
    closesAt: poll.closesAt.toISOString(),
    voteModel: poll.voteModel,
    quorumPercent: poll.quorumPercent,
    passingThresholdPercent: poll.passingThresholdPercent
  });
}

export async function markPollAnchoring(pollId: string, txid: string) {
  const updated = await db.poll.updateMany({
    where: {
      id: pollId,
      status: PollStatus.ANCHORING
    },
    data: {
      status: PollStatus.SCHEDULED,
      anchorTxid: txid
    }
  });

  if (updated.count !== 1) {
    throw new PollServiceError(
      "poll must be anchoring before it can be marked anchored",
      409,
      "POLL_NOT_ANCHORING"
    );
  }

  try {
    await recordPollCreatedAuditEvent({
      pollId,
      txid
    });
  } catch (error) {
    console.error("Failed to record public audit poll-created event", {
      pollId,
      txid,
      error
    });
  }

  return updated;
}

export async function releasePollAnchoring(pollId: string) {
  const updated = await db.poll.updateMany({
    where: {
      id: pollId,
      status: PollStatus.ANCHORING,
      anchorTxid: null
    },
    data: {
      status: PollStatus.DRAFT
    }
  });

  if (updated.count !== 1) {
    throw new PollServiceError(
      "poll must be anchoring without an anchor txid to be released",
      409,
      "POLL_NOT_RELEASEABLE"
    );
  }

  return updated;
}
