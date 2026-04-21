import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  readSessionMock,
  syncPollLifecycleForPollMock,
  reconcilePollVotesMock,
  syncWalletMock
} = vi.hoisted(() => ({
  readSessionMock: vi.fn(),
  syncPollLifecycleForPollMock: vi.fn(),
  reconcilePollVotesMock: vi.fn(),
  syncWalletMock: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({
  readSession: readSessionMock
}));

vi.mock("@/lib/services/poll-lifecycle", () => ({
  syncPollLifecycleForPoll: syncPollLifecycleForPollMock
}));

vi.mock("@/lib/services/poll-reconcile", () => ({
  reconcilePollVotes: reconcilePollVotesMock
}));

vi.mock("@/lib/zcash/zkool-client", () => ({
  getZkoolClient: () => ({
    syncWallet: syncWalletMock
  })
}));

import { POST } from "@/app/api/admin/polls/[pollId]/reconcile/route";

beforeEach(() => {
  readSessionMock.mockReset();
  syncPollLifecycleForPollMock.mockReset();
  reconcilePollVotesMock.mockReset();
  syncWalletMock.mockReset();
});

describe("admin reconcile route", () => {
  it("rejects non-admin callers", async () => {
    readSessionMock.mockResolvedValue({
      userId: "user_1",
      nick: "alice",
      role: "USER"
    });

    const response = await POST(
      new Request("http://localhost/api/admin/polls/poll_1/reconcile", {
        method: "POST"
      }) as never,
      { params: Promise.resolve({ pollId: "poll_1" }) } as never
    );

    expect(response.status).toBe(403);
  });

  it("syncs the collector and returns reconcile output for admins", async () => {
    readSessionMock.mockResolvedValue({
      userId: "admin_1",
      nick: "admin",
      role: "ADMIN"
    });
    syncPollLifecycleForPollMock.mockResolvedValue({
      pollId: "poll_1",
      previousStatus: "OPEN",
      status: "OPEN",
      transition: "NONE"
    });
    syncWalletMock.mockResolvedValue({ ok: true });
    reconcilePollVotesMock.mockResolvedValue({
      processed: 2
    });

    const response = await POST(
      new Request("http://localhost/api/admin/polls/poll_1/reconcile", {
        method: "POST"
      }) as never,
      { params: Promise.resolve({ pollId: "poll_1" }) } as never
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ processed: 2 });
    expect(syncPollLifecycleForPollMock).toHaveBeenCalledWith("poll_1");
    expect(syncWalletMock).toHaveBeenCalled();
    expect(reconcilePollVotesMock).toHaveBeenCalledWith("poll_1");
  });
});
