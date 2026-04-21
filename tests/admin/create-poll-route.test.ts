import { beforeEach, describe, expect, it, vi } from "vitest";

const { readSessionMock, createDraftPollMock, MockPollServiceError } = vi.hoisted(() => ({
  readSessionMock: vi.fn(),
  createDraftPollMock: vi.fn(),
  MockPollServiceError: class MockPollServiceError extends Error {
    constructor(
      message: string,
      public readonly status: 400 | 404 | 409,
      public readonly code: string,
      public readonly details?: Record<string, unknown>
    ) {
      super(message);
    }
  }
}));

vi.mock("@/lib/auth/session", () => ({
  readSession: readSessionMock
}));

vi.mock("@/lib/services/polls", () => ({
  PollServiceError: MockPollServiceError,
  createDraftPoll: createDraftPollMock
}));

import { POST } from "@/app/api/admin/polls/route";

beforeEach(() => {
  readSessionMock.mockReset();
  createDraftPollMock.mockReset();
});

function makeRequest(fields: Record<string, string>) {
  return new Request("http://localhost/api/admin/polls", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: "http://localhost"
    },
    body: new URLSearchParams(fields)
  });
}

describe("admin poll create route", () => {
  it("parses voter rows and forwards them to createDraftPoll", async () => {
    readSessionMock.mockResolvedValue({
      userId: "user_1",
      nick: "alice",
      role: "ADMIN"
    });
    createDraftPollMock.mockResolvedValue({ id: "poll_1" });

    const response = await POST(
      makeRequest({
        question: "Should the next shielded rollout proceed on mainnet?",
        opensAt: "2026-05-01T10:00:00.000Z",
        closesAt: "2026-05-03T10:00:00.000Z",
        optionALabel: "Approve",
        optionBLabel: "Reject",
        voters: "michae2xl,michaelguima@proton.me\nalice,alice@example.com"
      }) as never
    );

    expect(createDraftPollMock).toHaveBeenCalledWith(
      expect.objectContaining({
        question: "Should the next shielded rollout proceed on mainnet?",
        voters: [
          { nick: "michae2xl", email: "michaelguima@proton.me" },
          { nick: "alice", email: "alice@example.com" }
        ]
      }),
      "user_1"
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ pollId: "poll_1" });
  });

  it("returns a 400 for malformed voter rows", async () => {
    readSessionMock.mockResolvedValue({
      userId: "user_1",
      nick: "alice",
      role: "ADMIN"
    });

    const response = await POST(
      makeRequest({
        question: "Should the next shielded rollout proceed on mainnet?",
        opensAt: "2026-05-01T10:00:00.000Z",
        closesAt: "2026-05-03T10:00:00.000Z",
        optionALabel: "Approve",
        optionBLabel: "Reject",
        voters: "michae2xl"
      }) as never
    );

    expect(createDraftPollMock).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "INVALID_POLL_INPUT",
      details: {
        issues: [
          {
            path: ["voters"],
            message: expect.stringMatching(/invalid voter row/i)
          }
        ]
      }
    });
  });

  it("rejects create requests from an untrusted origin", async () => {
    readSessionMock.mockResolvedValue({
      userId: "user_1",
      nick: "alice",
      role: "ADMIN"
    });

    const response = await POST(
      new Request("http://localhost/api/admin/polls", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          origin: "https://evil.example"
        },
        body: new URLSearchParams({
          question: "Should the next shielded rollout proceed on mainnet?",
          opensAt: "2026-05-01T10:00:00.000Z",
          closesAt: "2026-05-03T10:00:00.000Z",
          optionALabel: "Approve",
          optionBLabel: "Reject",
          voters: "michae2xl,michaelguima@proton.me"
        })
      }) as never
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "forbidden_origin"
    });
    expect(createDraftPollMock).not.toHaveBeenCalled();
  });
});
