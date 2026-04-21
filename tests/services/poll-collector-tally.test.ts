import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchIncomingVotesMock, voteRequestFindManyMock } = vi.hoisted(() => ({
  fetchIncomingVotesMock: vi.fn(),
  voteRequestFindManyMock: vi.fn()
}));

vi.mock("@/lib/zcash/zkool-client", () => ({
  getZkoolClient: () => ({
    fetchIncomingVotes: fetchIncomingVotesMock
  })
}));

vi.mock("@/lib/db", () => ({
  db: {
    voteRequest: {
      findMany: voteRequestFindManyMock
    }
  }
}));

import {
  readPollCollectorTally,
  readPollCollectorTallies
} from "@/lib/services/collector-tally";

beforeEach(() => {
  fetchIncomingVotesMock.mockReset();
  voteRequestFindManyMock.mockReset();
});

describe("poll-scoped collector tally", () => {
  it("counts only collector notes that belong to the poll vote requests", async () => {
    voteRequestFindManyMock.mockResolvedValue([
      { shieldedAddress: "u1polla", ticket: { pollId: "poll_1" } },
      { shieldedAddress: "u1pollc", ticket: { pollId: "poll_1" } }
    ]);
    fetchIncomingVotesMock.mockResolvedValue([
      {
        shieldedAddress: "u1polla",
        txid: "txid_a",
        amountZat: 10000n,
        memo: "A",
        blockHeight: 10
      },
      {
        shieldedAddress: "u1otherb",
        txid: "txid_b",
        amountZat: 10000n,
        memo: "B",
        blockHeight: 11
      },
      {
        shieldedAddress: "u1pollc",
        txid: "txid_c",
        amountZat: 10000n,
        memo: "C",
        blockHeight: 12
      }
    ]);

    await expect(readPollCollectorTally("poll_1")).resolves.toEqual({
      totalConfirmed: 2,
      counts: {
        A: 1,
        B: 0,
        C: 1,
        D: 0,
        E: 0
      }
    });
  });

  it("builds per-poll summaries from one collector fetch and returns zero tallies when needed", async () => {
    voteRequestFindManyMock.mockResolvedValue([
      { shieldedAddress: "u1polla", ticket: { pollId: "poll_1" } },
      { shieldedAddress: "u1pollb", ticket: { pollId: "poll_1" } },
      { shieldedAddress: "u1polltwoa", ticket: { pollId: "poll_2" } }
    ]);
    fetchIncomingVotesMock.mockResolvedValue([
      {
        shieldedAddress: "u1polla",
        txid: "txid_a",
        amountZat: 10000n,
        memo: "A",
        blockHeight: 10
      },
      {
        shieldedAddress: "u1polltwoa",
        txid: "txid_b",
        amountZat: 10000n,
        memo: "B",
        blockHeight: 11
      },
      {
        shieldedAddress: "u1outside",
        txid: "txid_c",
        amountZat: 10000n,
        memo: "C",
        blockHeight: 12
      }
    ]);

    await expect(
      readPollCollectorTallies(["poll_1", "poll_2", "poll_3"])
    ).resolves.toEqual({
      poll_1: {
        totalConfirmed: 1,
        counts: {
          A: 1,
          B: 0,
          C: 0,
          D: 0,
          E: 0
        }
      },
      poll_2: {
        totalConfirmed: 1,
        counts: {
          A: 0,
          B: 1,
          C: 0,
          D: 0,
          E: 0
        }
      },
      poll_3: {
        totalConfirmed: 0,
        counts: {
          A: 0,
          B: 0,
          C: 0,
          D: 0,
          E: 0
        }
      }
    });
  });
});
