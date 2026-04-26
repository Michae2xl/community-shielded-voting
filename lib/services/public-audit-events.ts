import { db } from "@/lib/db";
import { getZkoolClient } from "@/lib/zcash/zkool-client";

type PublicAuditEventTypeValue =
  | "POLL_CREATED"
  | "VOTE_OBSERVED"
  | "VOTE_CONFIRMED";

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

async function createPublicAuditEvent(input: {
  pollId: string;
  eventType: PublicAuditEventTypeValue;
  sourceKey: string;
  summary: string;
  txid?: string | null;
  createdAt?: Date;
}) {
  try {
    await db.publicAuditEvent.create({
      data: {
        pollId: input.pollId,
        eventType: input.eventType,
        sourceKey: input.sourceKey,
        summary: input.summary,
        txid: input.txid ?? null,
        createdAt: input.createdAt ?? new Date()
      }
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return;
    }

    throw error;
  }
}

export async function recordPollCreatedAuditEvent(input: {
  pollId: string;
  txid: string;
  createdAt?: Date;
}) {
  await createPublicAuditEvent({
    pollId: input.pollId,
    eventType: "POLL_CREATED",
    sourceKey: `poll_created:${input.pollId}:${input.txid}`,
    summary: "Poll anchor recorded on the shielded rail.",
    txid: input.txid,
    createdAt: input.createdAt
  });
}

export async function recordConfirmedVoteAuditEvent(input: {
  pollId: string;
  txid: string;
  amountZat: bigint;
  createdAt?: Date;
}) {
  await createPublicAuditEvent({
    pollId: input.pollId,
    eventType: "VOTE_CONFIRMED",
    sourceKey: `vote_confirmed:${input.txid}`,
    summary: `Vote confirmed after one on-chain block (${input.amountZat.toString()} zats).`,
    txid: input.txid,
    createdAt: input.createdAt
  });
}

export async function syncObservedVoteAuditEvents(options?: { pollId?: string }) {
  const zkoolClient = getZkoolClient();

  if (!zkoolClient.isConfigured()) {
    return { created: 0, scanned: 0 };
  }

  const notes = await zkoolClient.fetchIncomingVotes({
    minConfirmations: 0
  });

  if (notes.length === 0) {
    return { created: 0, scanned: 0 };
  }

  const requests = await db.voteRequest.findMany({
    where: {
      shieldedAddress: {
        in: [...new Set(notes.map((note) => note.shieldedAddress))]
      },
      ...(options?.pollId
        ? {
            ticket: {
              pollId: options.pollId
            }
          }
        : {})
    },
    select: {
      shieldedAddress: true,
      ticket: {
        select: {
          pollId: true
        }
      }
    }
  });

  const pollByAddress = new Map(
    requests.map((request) => [request.shieldedAddress, request.ticket.pollId])
  );

  let created = 0;

  for (const note of notes) {
    const pollId = pollByAddress.get(note.shieldedAddress);

    if (!pollId) {
      continue;
    }

    try {
      await createPublicAuditEvent({
        pollId,
        eventType: "VOTE_OBSERVED",
        sourceKey: `vote_observed:${note.txid}`,
        summary: "Vote payment observed. Awaiting one-block confirmation.",
        txid: note.txid
      });
      created += 1;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        continue;
      }

      throw error;
    }
  }

  return {
    created,
    scanned: notes.length
  };
}
