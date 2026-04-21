import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  readSessionMock,
  creatorOwnsPollMock,
  anchorPollMock,
  buildAndStoreAnchorMemoMock,
  markPollAnchoringMock,
  releasePollAnchoringMock,
  MockPollServiceError,
  AnchorClientErrorMock
} = vi.hoisted(() => {
  class MockPollServiceError extends Error {
    constructor(
      message: string,
      public readonly status: 400 | 404 | 409,
      public readonly code: string,
      public readonly details?: Record<string, unknown>
    ) {
      super(message);
    }
  }

  class AnchorClientError extends Error {
    kind: "SAFE_PRE_SUBMISSION_FAILURE" | "UNKNOWN_SUBMISSION_STATE";

    constructor(
      message: string,
      kind: "SAFE_PRE_SUBMISSION_FAILURE" | "UNKNOWN_SUBMISSION_STATE"
    ) {
      super(message);
      this.kind = kind;
    }
  }

  return {
    readSessionMock: vi.fn(),
    creatorOwnsPollMock: vi.fn(),
    anchorPollMock: vi.fn(),
    buildAndStoreAnchorMemoMock: vi.fn(),
    markPollAnchoringMock: vi.fn(),
    releasePollAnchoringMock: vi.fn(),
    MockPollServiceError,
    AnchorClientErrorMock: AnchorClientError
  };
});

vi.mock("@/lib/auth/session", () => ({
  readSession: readSessionMock
}));

vi.mock("@/lib/auth/poll-ownership", () => ({
  creatorOwnsPoll: creatorOwnsPollMock
}));

vi.mock("@/lib/services/polls", () => ({
  PollServiceError: MockPollServiceError,
  buildAndStoreAnchorMemo: buildAndStoreAnchorMemoMock,
  markPollAnchoring: markPollAnchoringMock,
  releasePollAnchoring: releasePollAnchoringMock
}));

vi.mock("@/lib/zcash/anchor-client", () => ({
  AnchorClientError: AnchorClientErrorMock,
  getAnchorClient: () => ({
    anchorPoll: anchorPollMock
  })
}));

import { POST } from "@/app/api/admin/polls/[pollId]/anchor/route";

beforeEach(() => {
  readSessionMock.mockReset();
  creatorOwnsPollMock.mockReset();
  anchorPollMock.mockReset();
  buildAndStoreAnchorMemoMock.mockReset();
  markPollAnchoringMock.mockReset();
  releasePollAnchoringMock.mockReset();
});

function makeRequest() {
  return new Request("http://localhost/api/admin/polls/poll_1/anchor", {
    method: "POST",
    headers: {
      origin: "http://localhost"
    }
  });
}

describe("admin poll anchor route", () => {
  it("returns a 409 when the poll is not draft", async () => {
    readSessionMock.mockResolvedValue({
      userId: "user_1",
      nick: "alice",
      role: "ADMIN"
    });
    creatorOwnsPollMock.mockResolvedValue(true);
    buildAndStoreAnchorMemoMock.mockRejectedValue(
      new MockPollServiceError("not draft", 409, "POLL_NOT_DRAFT")
    );

    const response = await POST(
      makeRequest() as never,
      { params: Promise.resolve({ pollId: "poll_1" }) } as never
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "POLL_NOT_DRAFT"
    });
    expect(anchorPollMock).not.toHaveBeenCalled();
    expect(markPollAnchoringMock).not.toHaveBeenCalled();
  });

  it("rolls back on a safe pre-submission failure and allows retry", async () => {
    readSessionMock.mockResolvedValue({
      userId: "user_1",
      nick: "alice",
      role: "ADMIN"
    });
    creatorOwnsPollMock.mockResolvedValue(true);
    buildAndStoreAnchorMemoMock.mockResolvedValue("memo-1");
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
    expect(releasePollAnchoringMock).toHaveBeenCalledWith("poll_1");

    const secondResponse = await POST(
      makeRequest() as never,
      { params: Promise.resolve({ pollId: "poll_1" }) } as never
    );

    expect(secondResponse.status).toBe(200);
    expect(markPollAnchoringMock).toHaveBeenCalledWith("poll_1", "txid_1");
    expect(anchorPollMock).toHaveBeenCalledTimes(2);
  });

  it("leaves the poll anchoring on an unknown submission state failure", async () => {
    readSessionMock.mockResolvedValue({
      userId: "user_1",
      nick: "alice",
      role: "ADMIN"
    });
    creatorOwnsPollMock.mockResolvedValue(true);
    buildAndStoreAnchorMemoMock.mockResolvedValue("memo-1");
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
    await expect(response.json()).resolves.toEqual({
      error: "ANCHOR_UNKNOWN_STATE"
    });
    expect(releasePollAnchoringMock).not.toHaveBeenCalled();
    expect(markPollAnchoringMock).not.toHaveBeenCalled();
  });
});
