import { beforeEach, describe, expect, it, vi } from "vitest";

const { readSessionMock, lockTicketChoiceMock } = vi.hoisted(() => ({
  readSessionMock: vi.fn(),
  lockTicketChoiceMock: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({
  readSession: readSessionMock
}));

vi.mock("@/lib/services/ticket-locking", () => ({
  TicketLockingError: class TicketLockingError extends Error {
    constructor(
      message: string,
      public readonly status: 404 | 409,
      public readonly code: string
    ) {
      super(message);
    }
  },
  lockTicketChoice: lockTicketChoiceMock
}));

import { POST } from "@/app/api/polls/[pollId]/lock-choice/route";

beforeEach(() => {
  readSessionMock.mockReset();
  lockTicketChoiceMock.mockReset();
});

describe("poll lock-choice route", () => {
  it("rejects anonymous voters", async () => {
    readSessionMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/polls/poll_1/lock-choice", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost"
        },
        body: JSON.stringify({
          optionLetter: "A",
          confirmed: true
        })
      }) as never,
      { params: Promise.resolve({ pollId: "poll_1" }) } as never
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
  });

  it("locks a ticket for a temporary poll voter session", async () => {
    readSessionMock.mockResolvedValue({
      subjectType: "poll_voter_access",
      userId: "",
      pollVoterAccessId: "access_1",
      pollId: "poll_1",
      nick: "voter01",
      role: "VOTER_TEMP"
    });
    lockTicketChoiceMock.mockResolvedValue({
      ticketId: "ticket_1",
      pollId: "poll_1",
      status: "LOCKED",
      lockedOptionLetter: "E",
      lockedRequestId: "request_e"
    });

    const response = await POST(
      new Request("http://localhost/api/polls/poll_1/lock-choice", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost"
        },
        body: JSON.stringify({
          optionLetter: "E",
          confirmed: true
        })
      }) as never,
      { params: Promise.resolve({ pollId: "poll_1" }) } as never
    );

    expect(response.status).toBe(200);
    expect(lockTicketChoiceMock).toHaveBeenCalledWith({
      pollId: "poll_1",
      pollVoterAccessId: "access_1",
      optionLetter: "E"
    });
    await expect(response.json()).resolves.toEqual({
      ticketId: "ticket_1",
      pollId: "poll_1",
      status: "LOCKED",
      lockedOptionLetter: "E",
      lockedRequestId: "request_e"
    });
  });

  it("rejects missing confirmation acknowledgement", async () => {
    readSessionMock.mockResolvedValue({
      subjectType: "user",
      userId: "user_1",
      nick: "alice",
      role: "USER"
    });

    const response = await POST(
      new Request("http://localhost/api/polls/poll_1/lock-choice", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost"
        },
        body: JSON.stringify({
          optionLetter: "B",
          confirmed: false
        })
      }) as never,
      { params: Promise.resolve({ pollId: "poll_1" }) } as never
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "INVALID_LOCK_REQUEST"
    });
    expect(lockTicketChoiceMock).not.toHaveBeenCalled();
  });

  it("rejects lock attempts from an untrusted origin", async () => {
    readSessionMock.mockResolvedValue({
      subjectType: "poll_voter_access",
      userId: "",
      pollVoterAccessId: "access_1",
      pollId: "poll_1",
      nick: "voter01",
      role: "VOTER_TEMP"
    });

    const response = await POST(
      new Request("http://localhost/api/polls/poll_1/lock-choice", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example"
        },
        body: JSON.stringify({
          optionLetter: "A",
          confirmed: true
        })
      }) as never,
      { params: Promise.resolve({ pollId: "poll_1" }) } as never
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "forbidden_origin"
    });
    expect(lockTicketChoiceMock).not.toHaveBeenCalled();
  });
});
