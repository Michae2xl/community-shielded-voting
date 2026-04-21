import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  readSessionMock,
  createPollVoterAccessesMock,
  removePendingPollVoterAccessMock,
  MockPollVoterAccessServiceError
} = vi.hoisted(() => ({
  readSessionMock: vi.fn(),
  createPollVoterAccessesMock: vi.fn(),
  removePendingPollVoterAccessMock: vi.fn(),
  MockPollVoterAccessServiceError: class MockPollVoterAccessServiceError extends Error {
    constructor(
      message: string,
      public readonly status: 404 | 409,
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

vi.mock("@/lib/services/poll-voter-access", () => ({
  PollVoterAccessServiceError: MockPollVoterAccessServiceError,
  createPollVoterAccesses: createPollVoterAccessesMock,
  removePendingPollVoterAccess: removePendingPollVoterAccessMock
}));

import { POST as createVoterPOST } from "@/app/api/admin/polls/[pollId]/voters/route";
import { DELETE } from "@/app/api/admin/polls/[pollId]/voters/[accessId]/route";

beforeEach(() => {
  readSessionMock.mockReset();
  createPollVoterAccessesMock.mockReset();
  removePendingPollVoterAccessMock.mockReset();
});

describe("admin poll voter routes", () => {
  it("creates voter rows for an admin", async () => {
    readSessionMock.mockResolvedValue({
      userId: "admin_1",
      role: "ADMIN",
      nick: "admin"
    });
    createPollVoterAccessesMock.mockResolvedValue([
      {
        id: "access_1",
        nick: "voter01",
        email: "voter01@example.com"
      }
    ]);

    const response = await createVoterPOST(
      new Request("http://localhost/api/admin/polls/poll_1/voters", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost"
        },
        body: JSON.stringify({
          voters: [{ nick: "voter01", email: "voter01@example.com" }]
        })
      }) as never,
      { params: Promise.resolve({ pollId: "poll_1" }) }
    );

    expect(createPollVoterAccessesMock).toHaveBeenCalledWith({
      pollId: "poll_1",
      voters: [{ nick: "voter01", email: "voter01@example.com" }]
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      created: [
        {
          id: "access_1",
          nick: "voter01",
          email: "voter01@example.com"
        }
      ]
    });
  });

  it("returns a service conflict when removal is blocked", async () => {
    readSessionMock.mockResolvedValue({
      userId: "admin_1",
      role: "ADMIN",
      nick: "admin"
    });
    removePendingPollVoterAccessMock.mockRejectedValue(
      new MockPollVoterAccessServiceError(
        "voter already invited",
        409,
        "VOTER_ALREADY_INVITED"
      )
    );

    const response = await DELETE(
      new Request("http://localhost/api/admin/polls/poll_1/voters/access_1", {
        method: "DELETE",
        headers: {
          origin: "http://localhost"
        }
      }) as never,
      { params: Promise.resolve({ pollId: "poll_1", accessId: "access_1" }) }
    );

    expect(removePendingPollVoterAccessMock).toHaveBeenCalledWith({
      pollId: "poll_1",
      pollVoterAccessId: "access_1"
    });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "VOTER_ALREADY_INVITED",
      details: undefined
    });
  });
});
