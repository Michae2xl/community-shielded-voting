import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  transactionMock,
  ticketAssignmentFindFirstMock,
  voteTicketUpdateManyMock,
  voteRequestUpdateManyMock
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  ticketAssignmentFindFirstMock: vi.fn(),
  voteTicketUpdateManyMock: vi.fn(),
  voteRequestUpdateManyMock: vi.fn()
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: transactionMock
  }
}));

import {
  lockTicketChoice,
  TicketLockingError
} from "@/lib/services/ticket-locking";

function makeTx() {
  return {
    ticketAssignment: {
      findFirst: ticketAssignmentFindFirstMock
    },
    voteTicket: {
      updateMany: voteTicketUpdateManyMock
    },
    voteRequest: {
      updateMany: voteRequestUpdateManyMock
    }
  };
}

beforeEach(() => {
  transactionMock.mockReset();
  ticketAssignmentFindFirstMock.mockReset();
  voteTicketUpdateManyMock.mockReset();
  voteRequestUpdateManyMock.mockReset();
  transactionMock.mockImplementation(async (callback) => callback(makeTx()));
});

describe("lockTicketChoice", () => {
  it("locks the selected option and expires the other active requests", async () => {
    ticketAssignmentFindFirstMock.mockResolvedValue({
      ticket: {
        id: "ticket_1",
        pollId: "poll_1",
        status: "ISSUED",
        lockedRequestId: null,
        requests: [
          {
            id: "request_a",
            optionLetter: "A",
            status: "ACTIVE",
            shieldedAddress: "utest1a",
            zip321Uri: "uri-a"
          },
          {
            id: "request_b",
            optionLetter: "B",
            status: "ACTIVE",
            shieldedAddress: "utest1b",
            zip321Uri: "uri-b"
          }
        ]
      }
    });
    voteTicketUpdateManyMock.mockResolvedValue({ count: 1 });
    voteRequestUpdateManyMock.mockResolvedValue({ count: 1 });

    const result = await lockTicketChoice({
      pollId: "poll_1",
      pollVoterAccessId: "access_1",
      optionLetter: "B"
    });

    expect(voteTicketUpdateManyMock).toHaveBeenCalledWith({
      where: {
        id: "ticket_1",
        status: "ISSUED",
        lockedRequestId: null
      },
      data: expect.objectContaining({
        status: "LOCKED",
        lockedOptionLetter: "B",
        lockedRequestId: "request_b",
        lockedAt: expect.any(Date)
      })
    });
    expect(voteRequestUpdateManyMock).toHaveBeenCalledWith({
      where: {
        ticketId: "ticket_1",
        status: "ACTIVE",
        id: {
          not: "request_b"
        }
      },
      data: {
        status: "EXPIRED"
      }
    });
    expect(result).toMatchObject({
      ticketId: "ticket_1",
      pollId: "poll_1",
      status: "LOCKED",
      lockedOptionLetter: "B",
      lockedRequestId: "request_b",
      lockedRequest: expect.objectContaining({
        id: "request_b",
        optionLetter: "B"
      })
    });
  });

  it("refuses to relock a ticket that is already locked", async () => {
    ticketAssignmentFindFirstMock.mockResolvedValue({
      ticket: {
        id: "ticket_1",
        pollId: "poll_1",
        status: "LOCKED",
        lockedRequestId: "request_a",
        requests: [
          {
            id: "request_a",
            optionLetter: "A",
            status: "ACTIVE",
            shieldedAddress: "utest1a",
            zip321Uri: "uri-a"
          }
        ]
      }
    });

    await expect(
      lockTicketChoice({
        pollId: "poll_1",
        userId: "user_1",
        optionLetter: "B"
      })
    ).rejects.toMatchObject<TicketLockingError>({
      status: 409,
      code: "TICKET_NOT_ISSUABLE"
    });

    expect(voteTicketUpdateManyMock).not.toHaveBeenCalled();
    expect(voteRequestUpdateManyMock).not.toHaveBeenCalled();
  });
});
