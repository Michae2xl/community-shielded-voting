import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueInviteMock } = vi.hoisted(() => ({
  findUniqueInviteMock: vi.fn()
}));

vi.mock("@/lib/db", () => ({
  db: {
    pollInvite: {
      findUnique: findUniqueInviteMock
    }
  }
}));

import { GET } from "@/app/invites/[inviteToken]/route";

beforeEach(() => {
  findUniqueInviteMock.mockReset();
});

describe("invite open route", () => {
  it("redirects to login with the poll path without mutating invite state", async () => {
    findUniqueInviteMock.mockResolvedValue({
      id: "invite_1",
      pollId: "poll_1",
      openedAt: null
    });

    const response = await GET(
      new Request("http://localhost/invites/token_1") as never,
      { params: Promise.resolve({ inviteToken: "token_1" }) } as never
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/login?next=%2Fpolls%2Fpoll_1"
    );
  });
});
