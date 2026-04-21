import { beforeEach, describe, expect, it, vi } from "vitest";

const { readSessionMock, findOwnedPollMock, readPollCollectorTallyMock } = vi.hoisted(
  () => ({
    readSessionMock: vi.fn(),
    findOwnedPollMock: vi.fn(),
    readPollCollectorTallyMock: vi.fn()
  })
);

const { scheduleAutoPollReconcileMock } = vi.hoisted(() => ({
  scheduleAutoPollReconcileMock: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({
  readSession: readSessionMock
}));

vi.mock("@/lib/auth/poll-ownership", () => ({
  findOwnedPoll: findOwnedPollMock
}));

vi.mock("@/lib/services/collector-tally", () => ({
  readPollCollectorTally: readPollCollectorTallyMock
}));

vi.mock("@/lib/services/poll-auto-reconcile", () => ({
  scheduleAutoPollReconcile: scheduleAutoPollReconcileMock
}));

import { GET } from "@/app/api/admin/polls/[pollId]/collector-live/route";

beforeEach(() => {
  readSessionMock.mockReset();
  findOwnedPollMock.mockReset();
  readPollCollectorTallyMock.mockReset();
  scheduleAutoPollReconcileMock.mockReset();
});

describe("admin collector live route", () => {
  it("returns poll-scoped aggregate collector counts without receipt details", async () => {
    readSessionMock.mockResolvedValue({
      userId: "admin_1",
      nick: "admin",
      role: "ADMIN"
    });
    findOwnedPollMock.mockResolvedValue({ id: "poll_1" });
    readPollCollectorTallyMock.mockResolvedValue({
      totalConfirmed: 1,
      counts: {
        A: 1,
        B: 0,
        C: 0,
        D: 0,
        E: 0
      }
    });

    const response = await GET(
      new Request("http://localhost/api/admin/polls/poll_1/collector-live") as never,
      { params: Promise.resolve({ pollId: "poll_1" }) } as never
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      summary: {
        totalConfirmed: 1,
        options: {
          A: 1,
          B: 0,
          C: 0,
          D: 0,
          E: 0
        }
      }
    });
    expect(scheduleAutoPollReconcileMock).toHaveBeenCalledWith("poll_1");
  });
});
