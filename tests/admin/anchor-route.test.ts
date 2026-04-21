import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  readSessionMock,
  anchorPollMock,
  findUniqueMock,
  updateManyMock,
  AnchorClientErrorMock
} = vi.hoisted(() => {
  class AnchorClientError extends Error {
    kind: "SAFE_PRE_SUBMISSION_FAILURE" | "UNKNOWN_SUBMISSION_STATE";

    constructor(
      message: string,
      kind: "SAFE_PRE_SUBMISSION_FAILURE" | "UNKNOWN_SUBMISSION_STATE"
    ) {
      super(message);
      this.name = "AnchorClientError";
      this.kind = kind;
      Object.setPrototypeOf(this, new.target.prototype);
    }
  }

  return {
    readSessionMock: vi.fn(),
    anchorPollMock: vi.fn(),
    findUniqueMock: vi.fn(),
    updateManyMock: vi.fn(),
    AnchorClientErrorMock: AnchorClientError
  };
});

vi.mock("@/lib/auth/session", () => ({
  readSession: readSessionMock
}));

vi.mock("@/lib/zcash/anchor-client", () => ({
  AnchorClientError: AnchorClientErrorMock,
  getAnchorClient: () => ({
    anchorPoll: anchorPollMock
  })
}));

vi.mock("@/lib/db", () => ({
  db: {
    poll: {
      findUnique: findUniqueMock,
      updateMany: updateManyMock
    }
  }
}));

import { POST } from "@/app/api/admin/polls/[pollId]/anchor/route";

beforeEach(() => {
  readSessionMock.mockReset();
  anchorPollMock.mockReset();
  findUniqueMock.mockReset();
  updateManyMock.mockReset();
});

function makeRequest() {
  return new Request("http://localhost/api/admin/polls/poll_1/anchor", {
    method: "POST"
  });
}

function installDraftPoll() {
  const poll = {
    id: "poll_1",
    status: "DRAFT" as const,
    anchorTxid: null as string | null,
    questionHash: "hash_1",
    opensAt: new Date("2026-05-01T10:00:00.000Z"),
    closesAt: new Date("2026-05-03T10:00:00.000Z")
  };

  findUniqueMock.mockImplementation(async ({ where }: { where: { id: string } }) =>
    where.id === poll.id ? { ...poll } : null
  );
  updateManyMock.mockImplementation(
    async ({
      where,
      data
    }: {
      where: { id: string; status: typeof poll.status; anchorTxid?: null };
      data: Partial<typeof poll>;
    }) => {
      if (where.id !== poll.id || where.status !== poll.status) {
        return { count: 0 };
      }

      if ("anchorTxid" in where && poll.anchorTxid !== null) {
        return { count: 0 };
      }

      Object.assign(poll, data);
      return { count: 1 };
    }
  );

  return poll;
}

describe("admin poll anchor route", () => {
  it("returns a 409 when the poll is not draft", async () => {
    readSessionMock.mockResolvedValue({
      userId: "user_1",
      nick: "alice",
      role: "ADMIN"
    });
    findUniqueMock.mockResolvedValue({
      id: "poll_1",
      status: "SCHEDULED",
      questionHash: "hash_1",
      opensAt: new Date("2026-05-01T10:00:00.000Z"),
      closesAt: new Date("2026-05-03T10:00:00.000Z")
    });

    const response = await POST(
      makeRequest() as never,
      { params: Promise.resolve({ pollId: "poll_1" }) } as never
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "POLL_NOT_DRAFT"
    });
    expect(anchorPollMock).not.toHaveBeenCalled();
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it("rolls back to draft on a safe pre-submission failure and allows retry", async () => {
    const poll = installDraftPoll();
    readSessionMock.mockResolvedValue({
      userId: "user_1",
      nick: "alice",
      role: "ADMIN"
    });
    anchorPollMock
      .mockRejectedValueOnce(
        new AnchorClientErrorMock(
          "anchor failed",
          "SAFE_PRE_SUBMISSION_FAILURE"
        )
      )
      .mockResolvedValueOnce({
        txid: "txid_1",
        submittedAt: "2026-05-01T10:00:00.000Z"
      });

    const firstResponse = await POST(
      makeRequest() as never,
      { params: Promise.resolve({ pollId: "poll_1" }) } as never
    );

    expect(firstResponse.status).toBe(502);
    expect(poll.status).toBe("DRAFT");
    expect(poll.anchorTxid).toBeNull();

    const secondResponse = await POST(
      makeRequest() as never,
      { params: Promise.resolve({ pollId: "poll_1" }) } as never
    );

    expect(secondResponse.status).toBe(200);
    expect(anchorPollMock).toHaveBeenCalledTimes(2);
    expect(poll.status).toBe("SCHEDULED");
    expect(poll.anchorTxid).toBe("txid_1");
  });

  it("leaves the poll anchoring on an unknown submission state failure", async () => {
    const poll = installDraftPoll();
    readSessionMock.mockResolvedValue({
      userId: "user_1",
      nick: "alice",
      role: "ADMIN"
    });
    anchorPollMock.mockRejectedValueOnce(
      new AnchorClientErrorMock(
        "anchor uncertain",
        "UNKNOWN_SUBMISSION_STATE"
      )
    );

    const response = await POST(
      makeRequest() as never,
      { params: Promise.resolve({ pollId: "poll_1" }) } as never
    );

    expect(response.status).toBe(502);
    expect(poll.status).toBe("ANCHORING");
    expect(poll.anchorTxid).toBeNull();
    expect(updateManyMock).toHaveBeenCalledTimes(1);

    const retryResponse = await POST(
      makeRequest() as never,
      { params: Promise.resolve({ pollId: "poll_1" }) } as never
    );

    expect(retryResponse.status).toBe(409);
  });
});
