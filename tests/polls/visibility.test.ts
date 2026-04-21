import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  readSessionMock,
  pollFindManyMock,
  pollFindFirstMock
} = vi.hoisted(
  () => ({
    readSessionMock: vi.fn(),
    pollFindManyMock: vi.fn(),
    pollFindFirstMock: vi.fn()
  })
);

vi.mock("@/lib/auth/session", () => ({
  readSession: readSessionMock
}));

vi.mock("@/lib/db", () => ({
  db: {
    poll: {
      findMany: pollFindManyMock,
      findFirst: pollFindFirstMock
    }
  }
}));

import { GET as listPolls } from "@/app/api/polls/route";
import { GET as getPoll } from "@/app/api/polls/[pollId]/route";
import PollsPage from "@/app/polls/page";

beforeEach(() => {
  readSessionMock.mockReset();
  pollFindManyMock.mockReset();
  pollFindFirstMock.mockReset();
});

describe("voter poll visibility", () => {
  it("queries only OPEN polls for the voter list API and page query", async () => {
    readSessionMock.mockResolvedValue(null);
    pollFindManyMock.mockResolvedValue([]);

    await listPolls();
    await PollsPage();

    expect(pollFindManyMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          status: "OPEN"
        }
      })
    );
    expect(pollFindManyMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          status: "OPEN"
        }
      })
    );
  });

  it("keeps the public OPEN board visible even with a temporary session", async () => {
    readSessionMock.mockResolvedValue({
      subjectType: "poll_voter_access",
      userId: "",
      pollVoterAccessId: "access_1",
      pollId: "poll_1",
      nick: "michae2xl",
      role: "VOTER_TEMP"
    });
    pollFindManyMock.mockResolvedValue([]);

    await listPolls();
    await PollsPage();

    expect(pollFindManyMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          status: "OPEN"
        }
      })
    );
    expect(pollFindManyMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          status: "OPEN"
        }
      })
    );
  });

  it("returns 404 for unpublished poll details to voters", async () => {
    readSessionMock.mockResolvedValue({
      subjectType: "user",
      userId: "user_1",
      nick: "alice",
      role: "USER"
    });
    pollFindFirstMock.mockResolvedValue(null);

    const response = await getPoll(
      new Request("http://localhost/api/polls/poll_1") as never,
      { params: Promise.resolve({ pollId: "poll_1" }) } as never
    );

    expect(response.status).toBe(404);
    expect(pollFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "poll_1",
          status: {
            notIn: expect.any(Array)
          },
          eligibility: {
            some: {
              userId: "user_1"
            }
          }
        }
      })
    );
  });

  it("filters poll details through voterAccesses for temporary sessions", async () => {
    readSessionMock.mockResolvedValue({
      subjectType: "poll_voter_access",
      userId: "",
      pollVoterAccessId: "access_1",
      pollId: "poll_1",
      nick: "michae2xl",
      role: "VOTER_TEMP"
    });
    pollFindFirstMock.mockResolvedValue(null);

    const response = await getPoll(
      new Request("http://localhost/api/polls/poll_1") as never,
      { params: Promise.resolve({ pollId: "poll_1" }) } as never
    );

    expect(response.status).toBe(404);
    expect(pollFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "poll_1",
          status: {
            notIn: expect.any(Array)
          },
          voterAccesses: {
            some: {
              id: "access_1"
            }
          }
        }
      })
    );
  });

  it("renders a static OPEN summary board with poll id, totals, and percentages", async () => {
    readSessionMock.mockResolvedValue({
      subjectType: "user",
      userId: "user_1",
      nick: "alice",
      role: "USER"
    });
    pollFindManyMock.mockResolvedValue([
      {
        id: "poll_1",
        question: "Which option should we fund?",
        status: "OPEN",
        optionALabel: "Approve full rollout",
        optionBLabel: "Approve pilot",
        optionCLabel: null,
        optionDLabel: null,
        optionELabel: null,
        tally: {
          totalConfirmed: 1,
          countA: 1,
          countB: 0,
          countC: 0,
          countD: 0,
          countE: 0
        }
      },
      {
        id: "poll_2",
        question: "Zero vote poll",
        status: "OPEN",
        optionALabel: "Yes",
        optionBLabel: "No",
        optionCLabel: null,
        optionDLabel: null,
        optionELabel: null,
        tally: {
          totalConfirmed: 0,
          countA: 0,
          countB: 0,
          countC: 0,
          countD: 0,
          countE: 0
        }
      }
    ]);

    render(await PollsPage());

    expect(screen.getByText("Which option should we fund?")).toBeInTheDocument();
    expect(screen.getByText("Poll ID: poll_1")).toBeInTheDocument();
    expect(screen.getByText("1 valid vote")).toBeInTheDocument();
    expect(screen.getByText("Approve full rollout")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getAllByText("0%").length).toBeGreaterThan(0);
    expect(screen.getByText("Poll ID: poll_2")).toBeInTheDocument();
    expect(screen.getByText("0 valid votes")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Which option should we fund?" })).not.toBeInTheDocument();
  });
});
