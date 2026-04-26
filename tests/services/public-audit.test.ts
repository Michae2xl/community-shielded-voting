import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  publicAuditEventFindManyMock,
  pollFindManyMock,
  voteReceiptFindManyMock,
  pollTallyFindManyMock,
  fetchIncomingVotesMock,
  isConfiguredMock
} = vi.hoisted(() => ({
  publicAuditEventFindManyMock: vi.fn(),
  pollFindManyMock: vi.fn(),
  voteReceiptFindManyMock: vi.fn(),
  pollTallyFindManyMock: vi.fn(),
  fetchIncomingVotesMock: vi.fn(),
  isConfiguredMock: vi.fn()
}));

vi.mock("@/lib/db", () => ({
  db: {
    publicAuditEvent: {
      findMany: publicAuditEventFindManyMock
    },
    poll: {
      findMany: pollFindManyMock
    },
    voteReceipt: {
      findMany: voteReceiptFindManyMock
    },
    pollTally: {
      findMany: pollTallyFindManyMock
    }
  }
}));

vi.mock("@/lib/zcash/zkool-client", () => ({
  getZkoolClient: () => ({
    isConfigured: isConfiguredMock,
    fetchIncomingVotes: fetchIncomingVotesMock
  })
}));

import { readPublicAuditFeed } from "@/lib/services/public-audit";

beforeEach(() => {
  publicAuditEventFindManyMock.mockReset();
  pollFindManyMock.mockReset();
  voteReceiptFindManyMock.mockReset();
  pollTallyFindManyMock.mockReset();
  fetchIncomingVotesMock.mockReset();
  isConfiguredMock.mockReset();

  publicAuditEventFindManyMock.mockResolvedValue([]);
  pollFindManyMock.mockResolvedValue([]);
  voteReceiptFindManyMock.mockResolvedValue([]);
  pollTallyFindManyMock.mockResolvedValue([]);
  isConfiguredMock.mockReturnValue(true);
});

describe("public audit feed", () => {
  it("reads observed events from the database without touching the rail", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    publicAuditEventFindManyMock.mockResolvedValue([
      {
        eventType: "VOTE_OBSERVED",
        pollId: "poll_1",
        sourceKey: "vote_observed:tx_1",
        summary: "Vote payment observed. Awaiting one-block confirmation.",
        txid: "tx_1",
        createdAt: new Date("2026-04-22T12:00:00.000Z")
      }
    ]);

    const events = await readPublicAuditFeed(9);

    try {
      expect(events[0]).toMatchObject({
        id: "vote_observed:tx_1",
        type: "vote_observed",
        pollId: "poll_1",
        txid: "tx_1",
        isLive: true
      });
      expect(fetchIncomingVotesMock).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it("deduplicates materialized and legacy confirmed events by txid", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    publicAuditEventFindManyMock.mockResolvedValue([
      {
        eventType: "VOTE_CONFIRMED",
        pollId: "poll_1",
        sourceKey: "vote_confirmed:tx_1",
        summary: "Vote confirmed after one on-chain block (10000 zats).",
        txid: "tx_1",
        createdAt: new Date("2026-04-22T12:02:00.000Z")
      }
    ]);
    voteReceiptFindManyMock.mockResolvedValue([
      {
        id: "receipt_1",
        pollId: "poll_1",
        confirmedAt: new Date("2026-04-22T12:01:00.000Z"),
        txid: "tx_1",
        amountZat: 10000n
      }
    ]);

    const events = await readPublicAuditFeed(9);
    const confirmedEvents = events.filter((event) => event.id === "vote_confirmed:tx_1");

    try {
      expect(confirmedEvents).toHaveLength(1);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });
});
