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
  it("queries public polls without showing stale OPEN polls", async () => {
    readSessionMock.mockResolvedValue(null);
    pollFindManyMock.mockResolvedValue([]);

    await listPolls();
    await PollsPage();

    expect(pollFindManyMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          OR: [
            {
              status: "OPEN",
              closesAt: {
                gt: expect.any(Date)
              }
            },
            {
              status: {
                in: ["CLOSED", "FINALIZED", "ARCHIVED"]
              }
            }
          ]
        },
        orderBy: [{ closesAt: "desc" }, { createdAt: "desc" }]
      })
    );
    expect(pollFindManyMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          OR: [
            {
              status: "OPEN",
              closesAt: {
                gt: expect.any(Date)
              }
            },
            {
              status: {
                in: ["CLOSED", "FINALIZED", "ARCHIVED"]
              }
            }
          ]
        },
        orderBy: [{ closesAt: "desc" }, { createdAt: "desc" }]
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
          OR: [
            {
              status: "OPEN",
              closesAt: {
                gt: expect.any(Date)
              }
            },
            {
              status: {
                in: ["CLOSED", "FINALIZED", "ARCHIVED"]
              }
            }
          ]
        },
        orderBy: [{ closesAt: "desc" }, { createdAt: "desc" }]
      })
    );
    expect(pollFindManyMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          OR: [
            {
              status: "OPEN",
              closesAt: {
                gt: expect.any(Date)
              }
            },
            {
              status: {
                in: ["CLOSED", "FINALIZED", "ARCHIVED"]
              }
            }
          ]
        },
        orderBy: [{ closesAt: "desc" }, { createdAt: "desc" }]
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

  it("renders raw poll URLs as compact reference links on the public board", async () => {
    const referenceUrl =
      "https://daodao.zone/dao/juno1nktrulhakwmon3wlyajpwxyg54n39xx4y8hdaqlty7my/proposals/A145";

    readSessionMock.mockResolvedValue(null);
    pollFindManyMock.mockResolvedValue([
      {
        id: "poll_1",
        question: `Virtual Zcash Developer Workshop & IRL Developer Roundtable ${referenceUrl}`,
        status: "OPEN",
        optionALabel: "Approve",
        optionBLabel: "Reject",
        optionCLabel: null,
        optionDLabel: null,
        optionELabel: null,
        tally: {
          totalConfirmed: 3,
          countA: 3,
          countB: 0,
          countC: 0,
          countD: 0,
          countE: 0
        }
      }
    ]);

    render(await PollsPage());

    expect(
      screen.getByText("Virtual Zcash Developer Workshop & IRL Developer Roundtable")
    ).toBeInTheDocument();
    expect(screen.queryByText(/juno1nktrulhakwmon3wlyajpwxyg54n39xx4y8hdaqlty7my/)).not.toBeInTheDocument();

    const referenceLink = screen.getByRole("link", {
      name: /reference link daodao\.zone open/i
    });
    expect(referenceLink).toHaveAttribute("href", referenceUrl);
    expect(referenceLink).toHaveAttribute("target", "_blank");
    expect(referenceLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("OPEN")).toHaveClass("poll-summary-status");
  });

  it("renders live governance progress before the poll closes", async () => {
    readSessionMock.mockResolvedValue(null);
    pollFindManyMock.mockResolvedValue([
      {
        id: "poll_live",
        question: "Live governance poll",
        status: "OPEN",
        voteModel: "SINGLE_CHOICE",
        quorumPercent: 40,
        passingThresholdPercent: 67,
        optionALabel: "Confirm",
        optionBLabel: "Reject",
        optionCLabel: "Abstain",
        optionDLabel: null,
        optionELabel: null,
        tally: {
          totalConfirmed: 1,
          countA: 0,
          countB: 0,
          countC: 1,
          countD: 0,
          countE: 0
        },
        _count: {
          eligibility: 0,
          voterAccesses: 3
        }
      }
    ]);

    render(await PollsPage());

    expect(screen.getByText("Live governance poll")).toBeInTheDocument();
    expect(screen.getByText("Live poll")).toBeInTheDocument();
    expect(screen.getByText("Turnout")).toBeInTheDocument();
    expect(screen.getByText("33%")).toBeInTheDocument();
    expect(screen.getByText("1/3 voted")).toBeInTheDocument();
    expect(screen.getByText("Quorum 40%")).toBeInTheDocument();
    expect(screen.getByText("Decision")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText(/Approval 0% \/ 67%/)).toBeInTheDocument();
  });

  it("renders newest polls first on the public board", async () => {
    readSessionMock.mockResolvedValue(null);
    pollFindManyMock.mockResolvedValue([
      {
        id: "poll_new",
        question: "Newest poll",
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
      },
      {
        id: "poll_old",
        question: "Older poll",
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

    const newest = screen.getByText("Newest poll");
    const older = screen.getByText("Older poll");

    expect(
      newest.compareDocumentPosition(older) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("renders closed polls with the final public result", async () => {
    readSessionMock.mockResolvedValue(null);
    pollFindManyMock.mockResolvedValue([
      {
        id: "poll_closed",
        question: "Closed governance poll",
        status: "CLOSED",
        voteModel: "SINGLE_CHOICE",
        quorumPercent: 40,
        passingThresholdPercent: 67,
        optionALabel: "Approve",
        optionBLabel: "Reject",
        optionCLabel: null,
        optionDLabel: null,
        optionELabel: null,
        tally: {
          totalConfirmed: 15,
          countA: 9,
          countB: 6,
          countC: 0,
          countD: 0,
          countE: 0
        },
        _count: {
          eligibility: 0,
          voterAccesses: 18
        }
      }
    ]);

    render(await PollsPage());

    expect(screen.getByText("Closed governance poll")).toBeInTheDocument();
    expect(screen.getByText("Closed poll")).toBeInTheDocument();
    expect(screen.getByText("CLOSED")).toHaveClass("poll-summary-status");
    expect(screen.getByText("15 valid votes")).toBeInTheDocument();
    expect(screen.getByText("Turnout")).toBeInTheDocument();
    expect(screen.getByText("83%")).toBeInTheDocument();
    expect(screen.getByText("15/18 voted")).toBeInTheDocument();
    expect(screen.getByText("Quorum 40%")).toBeInTheDocument();
    expect(screen.getByText("Decision")).toBeInTheDocument();
    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(screen.getByText(/Approval 60% \/ 67%/)).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
  });
});
