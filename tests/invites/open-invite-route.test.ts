import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findUniqueInviteMock,
  updateInviteManyMock,
  updatePollVoterAccessMock,
  readSessionMock,
  writeSessionCookieMock
} = vi.hoisted(() => ({
  findUniqueInviteMock: vi.fn(),
  updateInviteManyMock: vi.fn(),
  updatePollVoterAccessMock: vi.fn(),
  readSessionMock: vi.fn(),
  writeSessionCookieMock: vi.fn()
}));

vi.mock("@/lib/db", () => ({
  db: {
    pollInvite: {
      findUnique: findUniqueInviteMock,
      updateMany: updateInviteManyMock
    },
    pollVoterAccess: {
      update: updatePollVoterAccessMock
    }
  }
}));

vi.mock("@/lib/auth/session", () => ({
  readSession: readSessionMock,
  writeSessionCookie: writeSessionCookieMock
}));

import { GET } from "@/app/invites/[inviteToken]/route";

beforeEach(() => {
  findUniqueInviteMock.mockReset();
  updateInviteManyMock.mockReset();
  updatePollVoterAccessMock.mockReset();
  readSessionMock.mockReset();
  writeSessionCookieMock.mockReset();
  readSessionMock.mockResolvedValue(null);
});

describe("invite open route", () => {
  it("redirects to login with the poll path without mutating invite state", async () => {
    findUniqueInviteMock.mockResolvedValue({
      id: "invite_1",
      pollId: "poll_1",
      openedAt: null
    });

    const response = await GET(
      new Request("http://localhost/invites/token_1") as never,
      { params: Promise.resolve({ inviteToken: "token_1" }) } as never
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/login?next=%2Fpolls%2Fpoll_1"
    );
    expect(updateInviteManyMock).not.toHaveBeenCalled();
  });

  it("opens a one-time poll voter access invite directly into the poll session", async () => {
    findUniqueInviteMock.mockResolvedValue({
      id: "invite_1",
      pollId: "poll_1",
      openedAt: null,
      pollVoterAccessId: "access_1",
      pollVoterAccess: {
        id: "access_1",
        pollId: "poll_1",
        nick: "michae2xl",
        status: "ACTIVE",
        expiresAt: new Date(Date.now() + 60_000)
      }
    });
    updateInviteManyMock.mockResolvedValue({ count: 1 });
    updatePollVoterAccessMock.mockResolvedValue({ id: "access_1" });

    const response = await GET(
      new Request("http://localhost/invites/token_1") as never,
      { params: Promise.resolve({ inviteToken: "token_1" }) } as never
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/polls/poll_1");
    expect(updateInviteManyMock).toHaveBeenCalledWith({
      where: {
        id: "invite_1",
        openedAt: null
      },
      data: expect.objectContaining({
        status: "OPENED",
        lastError: null
      })
    });
    expect(writeSessionCookieMock).toHaveBeenCalledWith({
      subjectType: "poll_voter_access",
      userId: "",
      pollVoterAccessId: "access_1",
      pollId: "poll_1",
      nick: "michae2xl",
      role: "VOTER_TEMP"
    });
  });

  it("rejects reused one-time poll voter access links", async () => {
    findUniqueInviteMock.mockResolvedValue({
      id: "invite_1",
      pollId: "poll_1",
      openedAt: new Date(),
      pollVoterAccessId: "access_1",
      pollVoterAccess: {
        id: "access_1",
        pollId: "poll_1",
        nick: "michae2xl",
        status: "ACTIVE",
        expiresAt: new Date(Date.now() + 60_000)
      }
    });
    updateInviteManyMock.mockResolvedValue({ count: 0 });

    const response = await GET(
      new Request("http://localhost/invites/token_1") as never,
      { params: Promise.resolve({ inviteToken: "token_1" }) } as never
    );

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({
      error: "INVITE_ALREADY_USED"
    });
    expect(writeSessionCookieMock).not.toHaveBeenCalled();
  });

  it("allows a reused one-time link when the same browser already has the session", async () => {
    findUniqueInviteMock.mockResolvedValue({
      id: "invite_1",
      pollId: "poll_1",
      openedAt: new Date(),
      pollVoterAccessId: "access_1",
      pollVoterAccess: {
        id: "access_1",
        pollId: "poll_1",
        nick: "michae2xl",
        status: "ACTIVE",
        expiresAt: new Date(Date.now() + 60_000)
      }
    });
    readSessionMock.mockResolvedValue({
      subjectType: "poll_voter_access",
      pollVoterAccessId: "access_1",
      pollId: "poll_1",
      nick: "michae2xl",
      role: "VOTER_TEMP"
    });

    const response = await GET(
      new Request("http://localhost/invites/token_1") as never,
      { params: Promise.resolve({ inviteToken: "token_1" }) } as never
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/polls/poll_1");
    expect(updateInviteManyMock).not.toHaveBeenCalled();
    expect(writeSessionCookieMock).not.toHaveBeenCalled();
  });
});
