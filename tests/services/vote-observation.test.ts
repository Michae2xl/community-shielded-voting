import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchIncomingVotesMock } = vi.hoisted(() => ({
  fetchIncomingVotesMock: vi.fn()
}));

vi.mock("@/lib/zcash/zkool-client", () => ({
  getZkoolClient: () => ({
    fetchIncomingVotes: fetchIncomingVotesMock
  })
}));

import { hasObservedVoteForAddresses } from "@/lib/services/vote-observation";

beforeEach(() => {
  fetchIncomingVotesMock.mockReset();
  fetchIncomingVotesMock.mockResolvedValue([]);
});

describe("hasObservedVoteForAddresses", () => {
  it("does not query the collector when there are no addresses", async () => {
    await expect(hasObservedVoteForAddresses([])).resolves.toBe(false);

    expect(fetchIncomingVotesMock).not.toHaveBeenCalled();
  });

  it("returns true when the collector sees one of the ticket addresses", async () => {
    fetchIncomingVotesMock.mockResolvedValue([
      {
        shieldedAddress: "u1matched",
        txid: "tx_1",
        amountZat: 10000n,
        memo: "memo",
        blockHeight: null
      }
    ]);

    await expect(
      hasObservedVoteForAddresses(["u1other", "u1matched"])
    ).resolves.toBe(true);

    expect(fetchIncomingVotesMock).toHaveBeenCalledWith({
      minConfirmations: 0
    });
  });

  it("keeps ticket APIs available when collector observation fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchIncomingVotesMock.mockRejectedValue(new Error("collector unavailable"));

    await expect(hasObservedVoteForAddresses(["u1ticket"])).resolves.toBe(false);

    expect(warnSpy).toHaveBeenCalledWith(
      "Vote observation failed; continuing without observed-vote hint.",
      expect.any(Error)
    );
    warnSpy.mockRestore();
  });
});
