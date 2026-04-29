import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { readSessionMock, pollFindManyMock } = vi.hoisted(() => ({
  readSessionMock: vi.fn(),
  pollFindManyMock: vi.fn()
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`redirect:${target}`);
  })
}));

vi.mock("@/lib/auth/session", () => ({
  readSession: readSessionMock
}));

vi.mock("@/lib/db", () => ({
  db: {
    poll: {
      findMany: pollFindManyMock
    }
  }
}));

import AdminPollDirectoryPage from "@/app/admin/polls/page";

beforeEach(() => {
  readSessionMock.mockReset();
  pollFindManyMock.mockReset();
});

describe("AdminPollDirectoryPage", () => {
  it("shows aggregate turnout without individual completion wording", async () => {
    readSessionMock.mockResolvedValue({
      subjectType: "user",
      userId: "admin_1",
      nick: "admin",
      role: "ADMIN"
    });
    pollFindManyMock.mockResolvedValue([
      {
        id: "poll_1",
        question: "Which option should we fund?",
        status: "OPEN",
        opensAt: new Date("2026-05-01T10:00:00.000Z"),
        closesAt: new Date("2026-05-03T10:00:00.000Z"),
        tally: {
          totalConfirmed: 1
        },
        voterAccesses: [
          {
            id: "access_1",
            assignments: [{ ticket: { status: "VOTED" } }]
          },
          {
            id: "access_2",
            assignments: [{ ticket: { status: "ISSUED" } }]
          }
        ]
      }
    ]);

    render(await AdminPollDirectoryPage());

    expect(screen.getByText("Votes received")).toBeInTheDocument();
    expect(screen.getByText("1/2 received (50%)")).toBeInTheDocument();
    expect(screen.queryByText("Completed voters")).not.toBeInTheDocument();
    expect(screen.queryByText(/how many voters completed/i)).not.toBeInTheDocument();
  });
});
