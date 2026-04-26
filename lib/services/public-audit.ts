import { db } from "@/lib/db";

export type PublicAuditEvent = {
  id: string;
  type: "poll_created" | "vote_observed" | "vote_confirmed";
  pollId: string;
  timestamp: string;
  summary: string;
  txid?: string;
  isLive?: boolean;
  isSample?: boolean;
};

function mapAuditEventType(
  eventType: "POLL_CREATED" | "VOTE_OBSERVED" | "VOTE_CONFIRMED"
): PublicAuditEvent["type"] {
  switch (eventType) {
    case "POLL_CREATED":
      return "poll_created";
    case "VOTE_OBSERVED":
      return "vote_observed";
    case "VOTE_CONFIRMED":
      return "vote_confirmed";
  }
}

const SAMPLE_PUBLIC_AUDIT_EVENTS: PublicAuditEvent[] = [
  {
    id: "sample-poll-created",
    type: "poll_created",
    pollId: "demo_local_governance",
    timestamp: "2026-04-21T10:00:00.000Z",
    summary: "Example poll anchor recorded on the shielded rail.",
    isSample: true
  },
  {
    id: "sample-vote-observed",
    type: "vote_observed",
    pollId: "demo_local_governance",
    timestamp: "2026-04-21T10:05:00.000Z",
    summary: "Example vote payment observed. Awaiting one-block confirmation.",
    isSample: true
  },
  {
    id: "sample-vote-confirmed",
    type: "vote_confirmed",
    pollId: "demo_local_governance",
    timestamp: "2026-04-21T10:10:00.000Z",
    summary: "Example vote confirmed after one on-chain block.",
    isSample: true
  }
];

function safeTimestamp(input: Date | string | null | undefined) {
  if (!input) {
    return new Date(0).toISOString();
  }

  return input instanceof Date ? input.toISOString() : input;
}

export function fillPublicAuditFeed(
  events: PublicAuditEvent[],
  limit = 9,
  minimumVisible = 3,
  allowSamples = false
) {
  const sorted = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  const minimumCount = Math.min(limit, minimumVisible);

  if (sorted.length >= minimumCount || !allowSamples) {
    return sorted.slice(0, limit);
  }

  const fallback = SAMPLE_PUBLIC_AUDIT_EVENTS.filter(
    (sample) => !sorted.some((event) => event.id === sample.id)
  );

  return [...sorted, ...fallback].slice(0, limit);
}

export async function readPublicAuditFeed(limit = 9): Promise<PublicAuditEvent[]> {
  const allowSamples = process.env.NODE_ENV !== "production";

  if (!process.env.DATABASE_URL) {
    return fillPublicAuditFeed([], limit, 3, allowSamples);
  }

  try {
    const [materializedEvents, polls, confirmedReceipts, tallies] = await Promise.all([
      db.publicAuditEvent.findMany({
        orderBy: {
          createdAt: "desc"
        },
        take: Math.max(limit * 2, 12),
        select: {
          eventType: true,
          pollId: true,
          sourceKey: true,
          summary: true,
          txid: true,
          createdAt: true
        }
      }),
      db.poll.findMany({
        where: {
          status: {
            in: ["SCHEDULED", "OPEN", "CLOSED", "FINALIZED", "ARCHIVED"]
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        take: Math.max(limit, 4),
        select: {
          id: true,
          createdAt: true,
          anchorTxid: true
        }
      }),
      db.voteReceipt.findMany({
        where: {
          status: "CONFIRMED",
          confirmedAt: {
            not: null
          }
        },
        orderBy: {
          confirmedAt: "desc"
        },
        take: Math.max(limit, 6),
        select: {
          id: true,
          pollId: true,
          confirmedAt: true,
          txid: true,
          amountZat: true
        }
      }),
      db.pollTally.findMany({
        where: {
          totalConfirmed: {
            gt: 0
          }
        },
        orderBy: {
          updatedAt: "desc"
        },
        take: Math.max(limit, 6),
        select: {
          pollId: true,
          totalConfirmed: true,
          updatedAt: true
        }
      })
    ]);

    const receiptPollIds = new Set(confirmedReceipts.map((receipt) => receipt.pollId));
    const events: PublicAuditEvent[] = [
      ...materializedEvents.map((event) => ({
        id: event.sourceKey,
        type: mapAuditEventType(event.eventType),
        pollId: event.pollId,
        timestamp: safeTimestamp(event.createdAt),
        summary: event.summary,
        txid: event.txid ?? undefined,
        isLive: event.eventType === "VOTE_OBSERVED"
      })),
      ...polls.map((poll) => ({
        id: `poll_created:${poll.id}:${poll.anchorTxid ?? safeTimestamp(poll.createdAt)}`,
        type: "poll_created" as const,
        pollId: poll.id,
        timestamp: safeTimestamp(poll.createdAt),
        summary: poll.anchorTxid
          ? "Poll anchor recorded on the shielded rail."
          : "Poll created and published to the shielded voting board.",
        txid: poll.anchorTxid ?? undefined
      })),
      ...confirmedReceipts.map((receipt) => ({
        id: `vote_confirmed:${receipt.txid}`,
        type: "vote_confirmed" as const,
        pollId: receipt.pollId,
        timestamp: safeTimestamp(receipt.confirmedAt),
        summary: `Vote confirmed after one on-chain block (${receipt.amountZat.toString()} zats).`,
        txid: receipt.txid
      })),
      ...tallies
        .filter((tally) => !receiptPollIds.has(tally.pollId))
        .map((tally) => ({
          id: `tally-${tally.pollId}-${safeTimestamp(tally.updatedAt)}`,
          type: "vote_confirmed" as const,
          pollId: tally.pollId,
          timestamp: safeTimestamp(tally.updatedAt),
          summary:
            tally.totalConfirmed === 1
              ? "1 valid vote reconciled on the public tally."
              : `${tally.totalConfirmed} valid votes reconciled on the public tally.`
      }))
    ];
    const deduped = Array.from(
      new Map(events.map((event) => [event.id, event])).values()
    );

    return fillPublicAuditFeed(deduped, limit, 3, allowSamples);
  } catch {
    return fillPublicAuditFeed([], limit, 3, allowSamples);
  }
}
