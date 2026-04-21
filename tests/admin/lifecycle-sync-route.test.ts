import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  readSessionMock,
  syncPollLifecycleForPollMock,
  creatorOwnsPollMock
} = vi.hoisted(() => ({
  readSessionMock: vi.fn(),
  syncPollLifecycleForPollMock: vi.fn(),
  creatorOwnsPollMock: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({
  readSession: readSessionMock
}));

vi.mock("@/lib/auth/poll-ownership", () => ({
  creatorOwnsPoll: creatorOwnsPollMock
}));

vi.mock("@/lib/services/poll-lifecycle", () => ({
  syncPollLifecycleForPoll: syncPollLifecycleForPollMock
}));

import { POST } from "@/app/api/admin/polls/[pollId]/lifecycle/sync/route";

beforeEach(() => {
  readSessionMock.mockReset();
  syncPollLifecycleForPollMock.mockReset();
  creatorOwnsPollMock.mockReset();
});

describe("admin lifecycle sync route", () => {
  it("rejects non-admin callers", async () => {
    readSessionMock.mockResolvedValue({
      userId: "user_1",
      nick: "alice",
      role: "USER"
    });

    const response = await POST(
      new Request("http://localhost/api/admin/polls/poll_1/lifecycle/sync", {
        method: "POST",
        headers: {
          origin: "http://localhost"
        }
      }) as never,
      { params: Promise.resolve({ pollId: "poll_1" }) } as never
    );

    expect(response.status).toBe(403);
  });

  it("returns the lifecycle transition for admins", async () => {
    readSessionMock.mockResolvedValue({
      userId: "admin_1",
      nick: "admin",
      role: "ADMIN"
    });
    creatorOwnsPollMock.mockResolvedValue(true);
    syncPollLifecycleForPollMock.mockResolvedValue({
      pollId: "poll_1",
      previousStatus: "SCHEDULED",
      status: "OPEN",
      transition: "SCHEDULED_TO_OPEN"
    });

    const response = await POST(
      new Request("http://localhost/api/admin/polls/poll_1/lifecycle/sync", {
        method: "POST",
        headers: {
          origin: "http://localhost"
        }
      }) as never,
      { params: Promise.resolve({ pollId: "poll_1" }) } as never
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      pollId: "poll_1",
      previousStatus: "SCHEDULED",
      status: "OPEN"
    });
  });
});
