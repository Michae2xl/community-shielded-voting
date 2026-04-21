import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  readSessionMock,
  findOwnedPollMock,
  pollVoterAccessFindManyMock,
  issueTicketForVoterMock,
  sendPollInvitesMock
} = vi.hoisted(() => ({
  readSessionMock: vi.fn(),
  findOwnedPollMock: vi.fn(),
  pollVoterAccessFindManyMock: vi.fn(),
  issueTicketForVoterMock: vi.fn(),
  sendPollInvitesMock: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({
  readSession: readSessionMock
}));

vi.mock("@/lib/auth/poll-ownership", () => ({
  findOwnedPoll: findOwnedPollMock
}));

vi.mock("@/lib/db", () => ({
  db: {
    pollVoterAccess: {
      findMany: pollVoterAccessFindManyMock
    }
  }
}));

vi.mock("@/lib/services/tickets", () => ({
  issueTicketForVoter: issueTicketForVoterMock
}));

vi.mock("@/lib/services/poll-invites", () => ({
  InviteServiceError: class InviteServiceError extends Error {},
  sendPollInvites: sendPollInvitesMock
}));

import { POST } from "@/app/api/admin/polls/[pollId]/invites/send-selected/route";

beforeEach(() => {
  readSessionMock.mockReset();
  findOwnedPollMock.mockReset();
  pollVoterAccessFindManyMock.mockReset();
  issueTicketForVoterMock.mockReset();
  sendPollInvitesMock.mockReset();
});

describe("send-selected invites route", () => {
  it("issues tickets and resends invites only for selected temporary voters", async () => {
    readSessionMock.mockResolvedValue({
      userId: "admin_1",
      role: "ADMIN",
      nick: "admin"
    });
    findOwnedPollMock.mockResolvedValue({
      id: "poll_1",
      feeZat: BigInt(10000),
      optionALabel: "Approve",
      optionBLabel: "Reject",
      optionCLabel: null,
      optionDLabel: null,
      optionELabel: null
    });
    pollVoterAccessFindManyMock.mockResolvedValue([{ id: "access_1" }]);
    sendPollInvitesMock.mockResolvedValue({
      totalEligible: 1,
      sent: 1,
      failed: 0,
      skippedMissingEmail: 0
    });

    const response = await POST(
      new Request("http://localhost/api/admin/polls/poll_1/invites/send-selected", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost"
        },
        body: JSON.stringify({ pollVoterAccessIds: ["access_1"] })
      }) as never,
      { params: Promise.resolve({ pollId: "poll_1" }) }
    );

    expect(issueTicketForVoterMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pollId: "poll_1",
        pollVoterAccessId: "access_1"
      })
    );
    expect(sendPollInvitesMock).toHaveBeenCalledWith({
      pollId: "poll_1",
      baseUrl: "http://localhost",
      pollVoterAccessIds: ["access_1"]
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      totalEligible: 1,
      sent: 1,
      failed: 0,
      skippedMissingEmail: 0
    });
  });
});
