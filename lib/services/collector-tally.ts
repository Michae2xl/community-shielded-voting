import { OPTION_LETTERS, type OptionLetter } from "@/lib/domain/options";
import { db } from "@/lib/db";
import { getZkoolClient } from "@/lib/zcash/zkool-client";
import type { IncomingVoteNote } from "@/lib/zcash/zkool-client";

export type CollectorReceipt = {
  txid: string;
  optionLetter: OptionLetter;
  amountZat: string;
  shieldedAddress: string;
  blockHeight: number | null;
};

export type CollectorTally = {
  totalConfirmed: number;
  counts: Record<OptionLetter, number>;
  receipts: CollectorReceipt[];
};

export type CollectorTallySummary = Pick<CollectorTally, "totalConfirmed" | "counts">;

export type PollCollectorTallies = Record<string, CollectorTallySummary>;

function isOptionLetter(value: string): value is OptionLetter {
  return OPTION_LETTERS.includes(value as OptionLetter);
}

function emptyCounts() {
  return {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    E: 0
  } satisfies Record<OptionLetter, number>;
}

function emptyTallySummary(): CollectorTallySummary {
  return {
    totalConfirmed: 0,
    counts: emptyCounts()
  };
}

function summarizeCollectorVotes(
  incomingVotes: IncomingVoteNote[],
  allowedAddresses?: Set<string>
): CollectorTally {
  const counts = emptyCounts();
  const receipts: CollectorReceipt[] = [];

  for (const note of incomingVotes) {
    if (allowedAddresses && !allowedAddresses.has(note.shieldedAddress)) {
      continue;
    }

    if (!isOptionLetter(note.memo)) {
      continue;
    }

    const optionLetter = note.memo;
    counts[optionLetter] += 1;

    receipts.push({
      txid: note.txid,
      optionLetter,
      amountZat: note.amountZat.toString(),
      shieldedAddress: note.shieldedAddress,
      blockHeight: note.blockHeight
    });
  }

  return {
    totalConfirmed: receipts.length,
    counts,
    receipts
  };
}

export async function readCollectorTally(): Promise<CollectorTally> {
  const incomingVotes = await getZkoolClient().fetchIncomingVotes();

  return summarizeCollectorVotes(incomingVotes);
}

export async function readPollCollectorTally(
  pollId: string
): Promise<CollectorTallySummary> {
  const tallies = await readPollCollectorTallies([pollId]);

  return tallies[pollId] ?? emptyTallySummary();
}

export async function readPollCollectorTallies(
  pollIds: string[]
): Promise<PollCollectorTallies> {
  const uniquePollIds = Array.from(new Set(pollIds));
  const tallies = Object.fromEntries(
    uniquePollIds.map((pollId) => [pollId, emptyTallySummary()])
  ) satisfies PollCollectorTallies;

  if (uniquePollIds.length === 0) {
    return tallies;
  }

  const voteRequests = await db.voteRequest.findMany({
    where: {
      ticket: {
        pollId: {
          in: uniquePollIds
        }
      }
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

  if (voteRequests.length === 0) {
    return tallies;
  }

  const pollIdByShieldedAddress = new Map(
    voteRequests.map((request) => [
      request.shieldedAddress,
      request.ticket.pollId
    ])
  );
  const incomingVotes = await getZkoolClient().fetchIncomingVotes();

  for (const note of incomingVotes) {
    const scopedPollId = pollIdByShieldedAddress.get(note.shieldedAddress);

    if (!scopedPollId || !isOptionLetter(note.memo)) {
      continue;
    }

    tallies[scopedPollId].totalConfirmed += 1;
    tallies[scopedPollId].counts[note.memo] += 1;
  }

  return tallies;
}
