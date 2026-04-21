import { describe, expect, it, beforeEach, vi } from "vitest";

const { readSessionMock, ticketAssignmentFindFirstMock, voteReceiptFindFirstMock } = vi.hoisted(() => ({
  readSessionMock: vi.fn(),
  ticketAssignmentFindFirstMock: vi.fn(),
  voteReceiptFindFirstMock: vi.fn()
}));

const { hasObservedVoteForAddressesMock } = vi.hoisted(() => ({
  hasObservedVoteForAddressesMock: vi.fn()
}));

const { scheduleAutoPollReconcileMock } = vi.hoisted(() => ({
  scheduleAutoPollReconcileMock: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({
  readSession: readSessionMock
}));

vi.mock("@/lib/db", () => ({
  db: {
    ticketAssignment: {
      findFirst: ticketAssignmentFindFirstMock
    },
    voteReceipt: {
      findFirst: voteReceiptFindFirstMock
    }
  }
}));

vi.mock("@/lib/services/vote-observation", () => ({
  hasObservedVoteForAddresses: hasObservedVoteForAddressesMock
}));

vi.mock("@/lib/services/poll-auto-reconcile", () => ({
  scheduleAutoPollReconcile: scheduleAutoPollReconcileMock
}));

import { GET as getVoteRequests } from "@/app/api/polls/[pollId]/my-vote-requests/route";
import { GET as getMyTicket } from "@/app/api/polls/[pollId]/my-ticket/route";

beforeEach(() => {
  readSessionMock.mockReset();
  ticketAssignmentFindFirstMock.mockReset();
  voteReceiptFindFirstMock.mockReset();
  hasObservedVoteForAddressesMock.mockReset();
  scheduleAutoPollReconcileMock.mockReset();
  hasObservedVoteForAddressesMock.mockResolvedValue(false);
  voteReceiptFindFirstMock.mockResolvedValue(null);
});

describe("poll vote request and ticket routes", () => {
  it("returns no vote requests when the poll is closed", async () => {
    readSessionMock.mockResolvedValue({
      subjectType: "user",
      userId: "user_1",
      nick: "alice",
      role: "USER"
    });
    ticketAssignmentFindFirstMock.mockResolvedValue({
      ticket: {
        status: "ISSUED",
        poll: {
          status: "CLOSED"
        },
        requests: [
          {
            id: "req_1",
            optionLetter: "A",
            shieldedAddress: "utest1examplea",
            zip321Uri: "zcash:utest1examplea?amount=0.0001&memo=QQ",
            status: "ACTIVE"
          }
        ]
      }
    });

    const response = await getVoteRequests(
      new Request("http://localhost/api/polls/poll_1/my-vote-requests") as never,
      { params: Promise.resolve({ pollId: "poll_1" }) } as never
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ requests: [] });
    expect(ticketAssignmentFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          ticket: {
            select: {
              status: true,
              lockedRequestId: true,
              poll: {
                select: {
                  status: true
                }
              },
              requests: {
                where: {
                  status: "ACTIVE"
                }
              }
            }
          }
        }
      })
    );
  });

  it("returns only active vote requests when the poll is open", async () => {
    readSessionMock.mockResolvedValue({
      subjectType: "user",
      userId: "user_1",
      nick: "alice",
      role: "USER"
    });
    ticketAssignmentFindFirstMock.mockResolvedValue({
      ticket: {
        status: "ISSUED",
        poll: {
          status: "OPEN"
        },
        requests: [
          {
            id: "req_1",
            optionLetter: "A",
            shieldedAddress: "utest1examplea",
            zip321Uri: "zcash:utest1examplea?amount=0.0001&memo=QQ",
            status: "ACTIVE"
          }
        ]
      }
    });

    const response = await getVoteRequests(
      new Request("http://localhost/api/polls/poll_1/my-vote-requests") as never,
      { params: Promise.resolve({ pollId: "poll_1" }) } as never
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      requests: [
        {
          id: "req_1",
          optionLetter: "A",
          shieldedAddress: "utest1examplea",
          zip321Uri: "zcash:utest1examplea?amount=0.0001&memo=QQ",
          status: "ACTIVE"
        }
      ]
    });
    expect(ticketAssignmentFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          pollId: "poll_1",
          userId: "user_1"
        }
      })
    );
    expect(scheduleAutoPollReconcileMock).toHaveBeenCalledWith("poll_1");
  });

  it("redacts the private ticket hash from the my-ticket response", async () => {
    readSessionMock.mockResolvedValue({
      subjectType: "user",
      userId: "user_1",
      nick: "alice",
      role: "USER"
    });
    ticketAssignmentFindFirstMock.mockResolvedValue({
      ticket: {
        id: "ticket_1",
        pollId: "poll_1",
        ticketPublicId: "ticket_public_1",
        ticketHash: "private_hash",
        status: "ISSUED",
        lockedOptionLetter: null,
        lockedRequestId: null,
        lockedAt: null,
        issuedAt: new Date("2026-05-01T10:00:00.000Z"),
        expiresAt: null,
        requests: []
      }
    });

    const response = await getMyTicket(
      new Request("http://localhost/api/polls/poll_1/my-ticket") as never,
      { params: Promise.resolve({ pollId: "poll_1" }) } as never
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ticket: {
        id: "ticket_1",
        pollId: "poll_1",
        ticketPublicId: "ticket_public_1",
        status: "ISSUED",
        observedVote: false,
        lockedOptionLetter: null,
        lockedRequestId: null,
        lockedAt: null,
        lockedRequest: null,
        receipt: null,
        issuedAt: "2026-05-01T10:00:00.000Z",
        expiresAt: null
      }
    });
    expect(scheduleAutoPollReconcileMock).toHaveBeenCalledWith("poll_1");
  });

  it("looks up ticket data by pollVoterAccessId for temporary voter sessions", async () => {
    readSessionMock.mockResolvedValue({
      subjectType: "poll_voter_access",
      userId: "",
      pollVoterAccessId: "access_1",
      pollId: "poll_1",
      nick: "voter01",
      role: "VOTER_TEMP"
    });
    ticketAssignmentFindFirstMock.mockResolvedValue({
      ticket: {
        status: "ISSUED",
        poll: {
          status: "OPEN"
        },
        requests: [
          {
            id: "req_1",
            optionLetter: "A",
            shieldedAddress: "utest1examplea",
            zip321Uri: "zcash:utest1examplea?amount=0.0001&memo=QQ",
            status: "ACTIVE"
          }
        ]
      }
    });

    const response = await getVoteRequests(
      new Request("http://localhost/api/polls/poll_1/my-vote-requests") as never,
      { params: Promise.resolve({ pollId: "poll_1" }) } as never
    );

    expect(response.status).toBe(200);
    expect(ticketAssignmentFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          pollId: "poll_1",
          pollVoterAccessId: "access_1"
        }
      })
    );
    expect(scheduleAutoPollReconcileMock).toHaveBeenCalledWith("poll_1");
  });

  it("returns no vote requests once the ticket is no longer issuable", async () => {
    readSessionMock.mockResolvedValue({
      subjectType: "user",
      userId: "user_1",
      nick: "alice",
      role: "USER"
    });
    ticketAssignmentFindFirstMock.mockResolvedValue({
      ticket: {
        status: "VOTED",
        poll: {
          status: "OPEN"
        },
        requests: [
          {
            id: "req_1",
            optionLetter: "A",
            shieldedAddress: "utest1examplea",
            zip321Uri: "zcash:utest1examplea?amount=0.0001&memo=QQ",
            status: "ACTIVE"
          }
        ]
      }
    });

    const response = await getVoteRequests(
      new Request("http://localhost/api/polls/poll_1/my-vote-requests") as never,
      { params: Promise.resolve({ pollId: "poll_1" }) } as never
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ requests: [] });
    expect(hasObservedVoteForAddressesMock).not.toHaveBeenCalled();
    expect(scheduleAutoPollReconcileMock).not.toHaveBeenCalled();
  });

  it("returns only the locked request once a ticket has been locked", async () => {
    readSessionMock.mockResolvedValue({
      subjectType: "user",
      userId: "user_1",
      nick: "alice",
      role: "USER"
    });
    ticketAssignmentFindFirstMock.mockResolvedValue({
      ticket: {
        status: "LOCKED",
        lockedRequestId: "req_2",
        poll: {
          status: "OPEN"
        },
        requests: [
          {
            id: "req_2",
            optionLetter: "E",
            shieldedAddress: "utest1examplee",
            zip321Uri: "zcash:utest1examplee?amount=0.0001&memo=RQ",
            status: "ACTIVE"
          }
        ]
      }
    });

    const response = await getVoteRequests(
      new Request("http://localhost/api/polls/poll_1/my-vote-requests") as never,
      { params: Promise.resolve({ pollId: "poll_1" }) } as never
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      requests: [
        {
          id: "req_2",
          optionLetter: "E",
          shieldedAddress: "utest1examplee",
          zip321Uri: "zcash:utest1examplee?amount=0.0001&memo=RQ",
          status: "ACTIVE"
        }
      ]
    });
    expect(scheduleAutoPollReconcileMock).toHaveBeenCalledWith("poll_1");
  });

  it("returns no vote requests once the collector already observed a vote for the ticket", async () => {
    readSessionMock.mockResolvedValue({
      subjectType: "user",
      userId: "user_1",
      nick: "alice",
      role: "USER"
    });
    hasObservedVoteForAddressesMock.mockResolvedValue(true);
    ticketAssignmentFindFirstMock.mockResolvedValue({
      ticket: {
        status: "ISSUED",
        poll: {
          status: "OPEN"
        },
        requests: [
          {
            id: "req_1",
            optionLetter: "A",
            shieldedAddress: "utest1examplea",
            zip321Uri: "zcash:utest1examplea?amount=0.0001&memo=QQ",
            status: "ACTIVE"
          }
        ]
      }
    });

    const response = await getVoteRequests(
      new Request("http://localhost/api/polls/poll_1/my-vote-requests") as never,
      { params: Promise.resolve({ pollId: "poll_1" }) } as never
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ requests: [] });
    expect(hasObservedVoteForAddressesMock).toHaveBeenCalledWith([
      "utest1examplea"
    ]);
    expect(scheduleAutoPollReconcileMock).toHaveBeenCalledWith("poll_1");
  });

  it("reports vote observation without promoting the ticket to confirmed", async () => {
    readSessionMock.mockResolvedValue({
      subjectType: "user",
      userId: "user_1",
      nick: "alice",
      role: "USER"
    });
    hasObservedVoteForAddressesMock.mockResolvedValue(true);
    ticketAssignmentFindFirstMock.mockResolvedValue({
      ticket: {
        id: "ticket_1",
        pollId: "poll_1",
        ticketPublicId: "ticket_public_1",
        ticketHash: "private_hash",
        status: "ISSUED",
        lockedOptionLetter: null,
        lockedRequestId: null,
        lockedAt: null,
        issuedAt: new Date("2026-05-01T10:00:00.000Z"),
        expiresAt: null,
        requests: [
          {
            id: "req_1",
            optionLetter: "A",
            shieldedAddress: "utest1examplea",
            zip321Uri: "zcash:utest1examplea?amount=0.0001&memo=QQ",
            status: "ACTIVE"
          }
        ]
      }
    });

    const response = await getMyTicket(
      new Request("http://localhost/api/polls/poll_1/my-ticket") as never,
      { params: Promise.resolve({ pollId: "poll_1" }) } as never
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ticket: {
        id: "ticket_1",
        pollId: "poll_1",
        ticketPublicId: "ticket_public_1",
        status: "ISSUED",
        observedVote: true,
        lockedOptionLetter: null,
        lockedRequestId: null,
        lockedAt: null,
        lockedRequest: null,
        receipt: null,
        issuedAt: "2026-05-01T10:00:00.000Z",
        expiresAt: null
      }
    });
    expect(scheduleAutoPollReconcileMock).toHaveBeenCalledWith("poll_1");
  });

  it("returns the confirmed receipt metadata once the ticket is voted", async () => {
    readSessionMock.mockResolvedValue({
      subjectType: "user",
      userId: "user_1",
      nick: "alice",
      role: "USER"
    });
    ticketAssignmentFindFirstMock.mockResolvedValue({
      ticket: {
        id: "ticket_1",
        pollId: "poll_1",
        ticketPublicId: "ticket_public_1",
        ticketHash: "private_hash",
        status: "VOTED",
        lockedOptionLetter: "E",
        lockedRequestId: "req_1",
        lockedAt: new Date("2026-05-01T10:00:00.000Z"),
        issuedAt: new Date("2026-05-01T10:00:00.000Z"),
        expiresAt: null,
        requests: []
      }
    });
    voteReceiptFindFirstMock.mockResolvedValue({
      receiptPublicId: "receipt_1",
      txid: "txid_1",
      confirmedAt: new Date("2026-05-01T10:05:00.000Z")
    });

    const response = await getMyTicket(
      new Request("http://localhost/api/polls/poll_1/my-ticket") as never,
      { params: Promise.resolve({ pollId: "poll_1" }) } as never
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ticket: {
        id: "ticket_1",
        pollId: "poll_1",
        ticketPublicId: "ticket_public_1",
        status: "VOTED",
        observedVote: false,
        lockedOptionLetter: "E",
        lockedRequestId: "req_1",
        lockedAt: "2026-05-01T10:00:00.000Z",
        lockedRequest: null,
        receipt: {
          receiptPublicId: "receipt_1",
          txid: "txid_1",
          confirmedAt: "2026-05-01T10:05:00.000Z"
        },
        issuedAt: "2026-05-01T10:00:00.000Z",
        expiresAt: null
      }
    });
    expect(scheduleAutoPollReconcileMock).not.toHaveBeenCalled();
  });
});
