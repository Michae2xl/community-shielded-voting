import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  publicAuditEventCreateMock,
  voteRequestFindManyMock,
  fetchIncomingVotesMock,
  isConfiguredMock
} = vi.hoisted(() => ({
  publicAuditEventCreateMock: vi.fn(),
  voteRequestFindManyMock: vi.fn(),
  fetchIncomingVotesMock: vi.fn(),
  isConfiguredMock: vi.fn()
}));

vi.mock("@/lib/db", () => ({
  db: {
    publicAuditEvent: {
      create: publicAuditEventCreateMock
    },
    voteRequest: {
      findMany: voteRequestFindManyMock
    }
  }
}));

vi.mock("@/lib/zcash/zkool-client", () => ({
  getZkoolClient: () => ({
    isConfigured: isConfiguredMock,
    fetchIncomingVotes: fetchIncomingVotesMock
  })
}));

import {
  recordConfirmedVoteAuditEvent,
  recordPollCreatedAuditEvent,
  syncObservedVoteAuditEvents
} from "@/lib/services/public-audit-events";

beforeEach(() => {
  publicAuditEventCreateMock.mockReset();
  voteRequestFindManyMock.mockReset();
  fetchIncomingVotesMock.mockReset();
  isConfiguredMock.mockReset();
  isConfiguredMock.mockReturnValue(true);
});

describe("public audit event writers", () => {
  it("writes poll-created events with a stable source key", async () => {
    publicAuditEventCreateMock.mockResolvedValue({ id: "evt_1" });

    await recordPollCreatedAuditEvent({
      pollId: "poll_1",
      txid: "anchor_tx_1"
    });

    expect(publicAuditEventCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pollId: "poll_1",
          eventType: "POLL_CREATED",
          sourceKey: "poll_created:poll_1:anchor_tx_1",
          txid: "anchor_tx_1"
        })
      })
    );
  });

  it("writes confirmed vote events with a txid-based source key", async () => {
    publicAuditEventCreateMock.mockResolvedValue({ id: "evt_2" });

    await recordConfirmedVoteAuditEvent({
      pollId: "poll_1",
      txid: "tx_1",
      amountZat: 10000n
    });

    expect(publicAuditEventCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pollId: "poll_1",
          eventType: "VOTE_CONFIRMED",
          sourceKey: "vote_confirmed:tx_1",
          txid: "tx_1"
        })
      })
    );
  });

  it("materializes observed vote events from recognized vote request addresses", async () => {
    fetchIncomingVotesMock.mockResolvedValue([
      {
        shieldedAddress: "zs1vote1",
        txid: "tx_1",
        amountZat: 10000n,
        memo: "A",
        blockHeight: null
      }
    ]);
    voteRequestFindManyMock.mockResolvedValue([
      {
        shieldedAddress: "zs1vote1",
        ticket: {
          pollId: "poll_1"
        }
      }
    ]);
    publicAuditEventCreateMock.mockResolvedValue({ id: "evt_3" });

    const result = await syncObservedVoteAuditEvents();

    expect(result).toEqual({
      created: 1,
      scanned: 1
    });
    expect(publicAuditEventCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pollId: "poll_1",
          eventType: "VOTE_OBSERVED",
          sourceKey: "vote_observed:tx_1",
          txid: "tx_1"
        })
      })
    );
  });
});
