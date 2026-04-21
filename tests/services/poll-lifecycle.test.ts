import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {}
}));

vi.mock("@/lib/db", () => ({
  db: dbMock
}));

import {
  syncAllPollLifecycles,
  syncPollLifecycleForPoll
} from "@/lib/services/poll-lifecycle";

type PollStatus = "SCHEDULED" | "OPEN" | "CLOSED";
type TicketStatus = "ISSUED" | "EXPIRED";
type VoteRequestStatus = "ACTIVE" | "EXPIRED";

function makeState(status: PollStatus, opensAt: Date, closesAt: Date) {
  return {
    poll: {
      id: "poll_1",
      status,
      opensAt,
      closesAt
    },
    ticketStatus: "ISSUED" as TicketStatus,
    requestStatus: "ACTIVE" as VoteRequestStatus
  };
}

function assignDb(state: ReturnType<typeof makeState>, openPollIds?: string[]) {
  Object.assign(dbMock, {
    poll: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === state.poll.id ? { ...state.poll } : null
      ),
      findMany: vi.fn(async () =>
        (openPollIds ?? [state.poll.id]).map((id) => ({ id }))
      ),
      update: vi.fn(
        async ({
          where,
          data
        }: {
          where: { id: string };
          data: { status: PollStatus };
        }) => {
          if (where.id !== state.poll.id) {
            throw new Error("unexpected poll id");
          }

          state.poll.status = data.status;
          return { ...state.poll };
        }
      )
    },
    voteTicket: {
      updateMany: vi.fn(
        async ({
          data
        }: {
          data: {
            status: TicketStatus;
          };
        }) => {
          state.ticketStatus = data.status;
          return { count: 1 };
        }
      )
    },
    voteRequest: {
      updateMany: vi.fn(
        async ({
          data
        }: {
          data: {
            status: VoteRequestStatus;
          };
        }) => {
          state.requestStatus = data.status;
          return { count: 1 };
        }
      )
    },
    $transaction: vi.fn(async (callback: (tx: typeof dbMock) => Promise<unknown>) =>
      callback(dbMock as typeof dbMock)
    )
  });
}

beforeEach(() => {
  for (const key of Object.keys(dbMock)) {
    delete (dbMock as Record<string, unknown>)[key];
  }
});

describe("poll lifecycle service", () => {
  it("opens scheduled polls when the open time has passed", async () => {
    const state = makeState(
      "SCHEDULED",
      new Date("2026-04-20T09:00:00.000Z"),
      new Date("2026-04-20T11:00:00.000Z")
    );
    assignDb(state);

    const result = await syncPollLifecycleForPoll(
      "poll_1",
      new Date("2026-04-20T10:00:00.000Z")
    );

    expect(result).toMatchObject({
      pollId: "poll_1",
      previousStatus: "SCHEDULED",
      status: "OPEN",
      transition: "SCHEDULED_TO_OPEN"
    });
    expect(state.poll.status).toBe("OPEN");
  });

  it("closes and expires active rails once the close time has passed", async () => {
    const state = makeState(
      "OPEN",
      new Date("2026-04-20T09:00:00.000Z"),
      new Date("2026-04-20T10:00:00.000Z")
    );
    assignDb(state);

    const result = await syncPollLifecycleForPoll(
      "poll_1",
      new Date("2026-04-20T12:00:00.000Z")
    );

    expect(result).toMatchObject({
      pollId: "poll_1",
      previousStatus: "OPEN",
      status: "CLOSED",
      transition: "OPEN_TO_CLOSED"
    });
    expect(state.poll.status).toBe("CLOSED");
    expect(state.ticketStatus).toBe("EXPIRED");
    expect(state.requestStatus).toBe("EXPIRED");
  });

  it("summarizes bulk lifecycle sync counts", async () => {
    const state = makeState(
      "SCHEDULED",
      new Date("2026-04-20T09:00:00.000Z"),
      new Date("2026-04-20T11:00:00.000Z")
    );
    assignDb(state);

    const result = await syncAllPollLifecycles(
      new Date("2026-04-20T10:00:00.000Z")
    );

    expect(result.processed).toBe(1);
    expect(result.opened).toBe(1);
    expect(result.closed).toBe(0);
  });
});
