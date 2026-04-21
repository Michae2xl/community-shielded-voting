import { describe, expect, it, beforeEach, vi } from "vitest";

const {
  ticketAssignmentFindFirstMock,
  transactionMock,
  isConfiguredMock,
  allocateVoteAddressMock
} = vi.hoisted(() => ({
  ticketAssignmentFindFirstMock: vi.fn(),
  transactionMock: vi.fn(),
  isConfiguredMock: vi.fn(),
  allocateVoteAddressMock: vi.fn()
}));

vi.mock("@/lib/db", () => ({
  db: {
    ticketAssignment: {
      findFirst: ticketAssignmentFindFirstMock
    },
    $transaction: transactionMock
  }
}));

vi.mock("@/lib/zcash/zkool-client", () => ({
  getZkoolClient: () => ({
    isConfigured: isConfiguredMock,
    allocateVoteAddress: allocateVoteAddressMock
  })
}));

import { issueTicketForVoter } from "@/lib/services/tickets";
import { ZcashConfigError } from "@/lib/zcash/runtime";

beforeEach(() => {
  ticketAssignmentFindFirstMock.mockReset();
  transactionMock.mockReset();
  isConfiguredMock.mockReset();
  allocateVoteAddressMock.mockReset();
  isConfiguredMock.mockReturnValue(false);
});

describe("issueTicketForVoter", () => {
  it("throws in production when the collector wallet is not configured", async () => {
    const originalNodeEnv = process.env.NODE_ENV;

    process.env.NODE_ENV = "production";
    ticketAssignmentFindFirstMock.mockResolvedValueOnce(null);

    await expect(
      issueTicketForVoter({
        pollId: "poll_1",
        userId: "user_1",
        feeZec: "0.0001",
        optionLetters: ["A", "B"]
      })
    ).rejects.toBeInstanceOf(ZcashConfigError);

    process.env.NODE_ENV = originalNodeEnv;
  });

  it("creates vote requests only for the configured option letters", async () => {
    const voteTicketCreateMock = vi.fn().mockResolvedValue({ id: "ticket_1" });
    const voteRequestCreateManyMock = vi.fn().mockResolvedValue({ count: 2 });

    ticketAssignmentFindFirstMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ticket: {
          id: "ticket_1",
          pollId: "poll_1",
          ticketPublicId: "ticket_public_1",
          ticketHash: "private_hash",
          status: "ISSUED",
          issuedAt: new Date("2026-05-01T10:00:00.000Z"),
          expiresAt: null,
          requests: [
            {
              optionLetter: "A",
              zip321Uri: "uri-a"
            },
            {
              optionLetter: "C",
              zip321Uri: "uri-c"
            }
          ]
        }
      });

    transactionMock.mockImplementation(async (callback) =>
      callback({
        voteTicket: {
          create: voteTicketCreateMock
        },
        voteRequest: {
          createMany: voteRequestCreateManyMock
        }
      })
    );

    const ticket = await issueTicketForVoter({
      pollId: "poll_1",
      userId: "user_1",
      feeZec: "0.0001",
      optionLetters: ["A", "C"]
    });

    expect(voteTicketCreateMock).toHaveBeenCalled();
    expect(voteRequestCreateManyMock).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ optionLetter: "A" }),
        expect.objectContaining({ optionLetter: "C" })
      ])
    });
    expect(voteRequestCreateManyMock.mock.calls[0]?.[0]?.data).toHaveLength(2);
    expect(ticket).toMatchObject({
      id: "ticket_1",
      ticketPublicId: "ticket_public_1"
    });
  });

  it("issues a ticket for a temporary poll voter access row", async () => {
    const voteTicketCreateMock = vi.fn().mockResolvedValue({ id: "ticket_1" });
    const voteRequestCreateManyMock = vi.fn().mockResolvedValue({ count: 2 });

    ticketAssignmentFindFirstMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ticket: {
          id: "ticket_1",
          pollId: "poll_1",
          ticketPublicId: "ticket_public_1",
          ticketHash: "private_hash",
          status: "ISSUED",
          issuedAt: new Date("2026-05-01T10:00:00.000Z"),
          expiresAt: null,
          requests: [
            {
              optionLetter: "A",
              zip321Uri: "uri-a"
            },
            {
              optionLetter: "B",
              zip321Uri: "uri-b"
            }
          ]
        }
      });

    transactionMock.mockImplementation(async (callback) =>
      callback({
        voteTicket: {
          create: voteTicketCreateMock
        },
        voteRequest: {
          createMany: voteRequestCreateManyMock
        }
      })
    );

    await issueTicketForVoter({
      pollId: "poll_1",
      pollVoterAccessId: "access_1",
      feeZec: "0.0001",
      optionLetters: ["A", "B"]
    });

    expect(voteTicketCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignment: {
            create: {
              pollVoterAccessId: "access_1"
            }
          }
        })
      })
    );
  });

  it("uses zkool diversified addresses when the collector is configured", async () => {
    const voteTicketCreateMock = vi.fn().mockResolvedValue({ id: "ticket_1" });
    const voteRequestCreateManyMock = vi.fn().mockResolvedValue({ count: 2 });

    ticketAssignmentFindFirstMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ticket: {
          id: "ticket_1",
          pollId: "poll_1",
          ticketPublicId: "ticket_public_1",
          ticketHash: "private_hash",
          status: "ISSUED",
          issuedAt: new Date("2026-05-01T10:00:00.000Z"),
          expiresAt: null,
          requests: [
            {
              optionLetter: "A",
              shieldedAddress: "utest1realaddressa",
              zip321Uri: "uri-a"
            },
            {
              optionLetter: "B",
              shieldedAddress: "utest1realaddressb",
              zip321Uri: "uri-b"
            }
          ]
        }
      });

    isConfiguredMock.mockReturnValue(true);
    allocateVoteAddressMock
      .mockResolvedValueOnce("utest1realaddressa")
      .mockResolvedValueOnce("utest1realaddressb");

    transactionMock.mockImplementation(async (callback) =>
      callback({
        voteTicket: {
          create: voteTicketCreateMock
        },
        voteRequest: {
          createMany: voteRequestCreateManyMock
        }
      })
    );

    await issueTicketForVoter({
      pollId: "poll_1",
      userId: "user_1",
      feeZec: "0.0001",
      optionLetters: ["A", "B"]
    });

    expect(allocateVoteAddressMock).toHaveBeenCalledTimes(2);
    expect(voteRequestCreateManyMock).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          optionLetter: "A",
          shieldedAddress: "utest1realaddressa"
        }),
        expect.objectContaining({
          optionLetter: "B",
          shieldedAddress: "utest1realaddressb"
        })
      ])
    });
  });

  it("returns the existing ticket after a unique-constraint race", async () => {
    ticketAssignmentFindFirstMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ticket: {
          id: "ticket_1",
          pollId: "poll_1",
          ticketPublicId: "ticket_public_1",
          ticketHash: "private_hash",
          status: "ISSUED",
          issuedAt: new Date("2026-05-01T10:00:00.000Z"),
          expiresAt: null,
          requests: []
        }
      });
    transactionMock.mockRejectedValueOnce({ code: "P2002" });

    const ticket = await issueTicketForVoter({
      pollId: "poll_1",
      userId: "user_1",
      feeZec: "0.0001",
      optionLetters: ["A", "B"]
    });

    expect(ticket).toMatchObject({
      id: "ticket_1",
      ticketPublicId: "ticket_public_1",
      ticketHash: "private_hash"
    });
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(ticketAssignmentFindFirstMock).toHaveBeenCalledTimes(2);
  });
});
