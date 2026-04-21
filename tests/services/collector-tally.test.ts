import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchIncomingVotesMock } = vi.hoisted(() => ({
  fetchIncomingVotesMock: vi.fn()
}));

vi.mock("@/lib/zcash/zkool-client", () => ({
  getZkoolClient: () => ({
    fetchIncomingVotes: fetchIncomingVotesMock
  })
}));

vi.mock("@/lib/db", () => ({
  db: {
    voteRequest: {
      findMany: vi.fn()
    }
  }
}));

import { readCollectorTally } from "@/lib/services/collector-tally";

beforeEach(() => {
  fetchIncomingVotesMock.mockReset();
});

describe("collector tally service", () => {
  it("counts only memo letters A-E", async () => {
    fetchIncomingVotesMock.mockResolvedValue([
      {
        shieldedAddress: "u1a",
        txid: "txid_a",
        amountZat: 10000n,
        memo: "A",
        blockHeight: 1
      },
      {
        shieldedAddress: "u1b",
        txid: "txid_b",
        amountZat: 10000n,
        memo: "B",
        blockHeight: 2
      },
      {
        shieldedAddress: "u1x",
        txid: "txid_x",
        amountZat: 50000n,
        memo: "POLL|v1|anchor",
        blockHeight: 3
      }
    ]);

    await expect(readCollectorTally()).resolves.toEqual({
      totalConfirmed: 2,
      counts: {
        A: 1,
        B: 1,
        C: 0,
        D: 0,
        E: 0
      },
      receipts: [
        {
          txid: "txid_a",
          optionLetter: "A",
          amountZat: "10000",
          shieldedAddress: "u1a",
          blockHeight: 1
        },
        {
          txid: "txid_b",
          optionLetter: "B",
          amountZat: "10000",
          shieldedAddress: "u1b",
          blockHeight: 2
        }
      ]
    });
  });
});
