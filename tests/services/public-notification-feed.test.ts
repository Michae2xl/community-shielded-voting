import { beforeEach, describe, expect, it, vi } from "vitest";

const { pollFindManyMock } = vi.hoisted(() => ({
  pollFindManyMock: vi.fn()
}));

vi.mock("@/lib/db", () => ({
  db: {
    poll: {
      findMany: pollFindManyMock
    }
  }
}));

import {
  buildAtomFeed,
  buildRssFeed,
  readPublicNotificationFeedItems
} from "@/lib/services/public-notification-feed";

beforeEach(() => {
  pollFindManyMock.mockReset();
  process.env.APP_BASE_URL = "https://vote.example.com";
});

describe("public notification feed", () => {
  it("publishes opened, closed, and aggregate result items without voter data", async () => {
    pollFindManyMock.mockResolvedValue([
      {
        id: "poll_1",
        question: "Should the treasury fund the next rollout?",
        status: "CLOSED",
        opensAt: new Date("2026-05-01T10:00:00.000Z"),
        closesAt: new Date("2026-05-03T10:00:00.000Z"),
        updatedAt: new Date("2026-05-03T10:05:00.000Z"),
        voteModel: "SINGLE_CHOICE",
        quorumPercent: 40,
        passingThresholdPercent: 67,
        tally: {
          countA: 8,
          totalConfirmed: 15,
          updatedAt: new Date("2026-05-03T10:04:00.000Z")
        },
        _count: {
          eligibility: 0,
          voterAccesses: 18
        }
      }
    ]);

    const items = await readPublicNotificationFeedItems();
    const atom = buildAtomFeed(items);
    const rss = buildRssFeed(items);

    expect(items.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "poll-opened:poll_1",
        "poll-closed:poll_1",
        expect.stringMatching(/^result-published:poll_1:/)
      ])
    );
    expect(atom).toContain("Result published");
    expect(atom).toContain("Decision: Rejected.");
    expect(atom).toContain("Turnout 83% (15/18 voted).");
    expect(rss).toContain("https://vote.example.com/polls");
    expect(`${atom}\n${rss}`).not.toMatch(/michaelguima|alice@example|signalUsername/i);
  });
});
