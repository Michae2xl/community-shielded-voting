import { beforeEach, describe, expect, it, vi } from "vitest";

const { readSessionMock, sendPollInvitesMock } = vi.hoisted(() => ({
  readSessionMock: vi.fn(),
  sendPollInvitesMock: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({
  readSession: readSessionMock
}));

vi.mock("@/lib/services/poll-invites", () => ({
  InviteServiceError: class InviteServiceError extends Error {
    constructor(
      message: string,
      public readonly status: 400 | 404 | 409 | 503,
      public readonly code: string
    ) {
      super(message);
    }
  },
  sendPollInvites: sendPollInvitesMock
}));

import { POST } from "@/app/api/admin/polls/[pollId]/invites/send/route";

beforeEach(() => {
  readSessionMock.mockReset();
  sendPollInvitesMock.mockReset();
});

describe("admin send invites route", () => {
  it("rejects non-admin callers", async () => {
    readSessionMock.mockResolvedValue({
      userId: "user_1",
      nick: "alice",
      role: "USER"
    });

    const response = await POST(
      new Request("http://localhost/api/admin/polls/poll_1/invites/send", {
        method: "POST"
      }) as never,
      { params: Promise.resolve({ pollId: "poll_1" }) } as never
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "forbidden"
    });
  });

  it("returns the invite send summary for admins", async () => {
    readSessionMock.mockResolvedValue({
      userId: "admin_1",
      nick: "admin",
      role: "ADMIN"
    });
    sendPollInvitesMock.mockResolvedValue({
      totalEligible: 3,
      sent: 2,
      failed: 0,
      skippedMissingEmail: 1
    });

    const response = await POST(
      new Request("http://localhost/api/admin/polls/poll_1/invites/send", {
        method: "POST"
      }) as never,
      { params: Promise.resolve({ pollId: "poll_1" }) } as never
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      totalEligible: 3,
      sent: 2,
      failed: 0,
      skippedMissingEmail: 1
    });
    expect(sendPollInvitesMock).toHaveBeenCalledWith({
      pollId: "poll_1",
      baseUrl: "http://localhost"
    });
  });
});
