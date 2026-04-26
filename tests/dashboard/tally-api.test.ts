import { beforeEach, describe, expect, it, vi } from "vitest";
import { mapTallyResponse } from "@/app/api/admin/polls/[pollId]/tally/route";

const { readSessionMock, pollFindFirstMock, pollTallyFindUniqueMock } = vi.hoisted(
  () => ({
    readSessionMock: vi.fn(),
    pollFindFirstMock: vi.fn(),
    pollTallyFindUniqueMock: vi.fn()
  })
);

vi.mock("@/lib/auth/session", () => ({
  readSession: readSessionMock
}));

vi.mock("@/lib/db", () => ({
  db: {
    poll: {
      findFirst: pollFindFirstMock
    },
    pollTally: {
      findUnique: pollTallyFindUniqueMock
    }
  }
}));

import { GET as getTally } from "@/app/api/admin/polls/[pollId]/tally/route";

beforeEach(() => {
  readSessionMock.mockReset();
  pollFindFirstMock.mockReset();
  pollTallyFindUniqueMock.mockReset();
});

describe("mapTallyResponse", () => {
  it("returns aggregate-only tally fields", () => {
    const response = mapTallyResponse({
      countA: 4,
      countB: 2,
      countC: 1,
      countD: 0,
      countE: 3,
      totalConfirmed: 10
    });

    expect(response.totalConfirmed).toBe(10);
    expect("userId" in response).toBe(false);
    expect(response.options.A).toBe(4);
  });
});

describe("GET /api/admin/polls/[pollId]/tally", () => {
  it("returns zero counts when the tally row has not been created yet", async () => {
    readSessionMock.mockResolvedValue({
      userId: "user_1",
      nick: "alice",
      role: "ADMIN"
    });
    pollFindFirstMock.mockResolvedValue({ id: "poll_1" });
    pollTallyFindUniqueMock.mockResolvedValue(null);

    const response = await getTally(
      new Request("http://localhost/api/admin/polls/poll_1/tally") as never,
      { params: Promise.resolve({ pollId: "poll_1" }) } as never
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      totalConfirmed: 0,
      options: {
        A: 0,
        B: 0,
        C: 0,
        D: 0,
        E: 0
      }
    });
  });
});
