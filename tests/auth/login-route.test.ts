import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findUniqueMock,
  authenticateTemporaryPollVoterMock,
  markPollInviteOpenedMock,
  verifyPasswordMock,
  writeSessionCookieMock
} = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  authenticateTemporaryPollVoterMock: vi.fn(),
  markPollInviteOpenedMock: vi.fn(),
  verifyPasswordMock: vi.fn(),
  writeSessionCookieMock: vi.fn()
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: findUniqueMock
    }
  }
}));

vi.mock("@/lib/auth/password", () => ({
  verifyPassword: verifyPasswordMock
}));

vi.mock("@/lib/services/poll-voter-access", () => ({
  authenticateTemporaryPollVoter: authenticateTemporaryPollVoterMock
}));

vi.mock("@/lib/services/poll-invites", () => ({
  markPollInviteOpened: markPollInviteOpenedMock
}));

vi.mock("@/lib/auth/session", () => ({
  writeSessionCookie: writeSessionCookieMock
}));

import { POST } from "@/app/api/auth/login/route";

beforeEach(() => {
  findUniqueMock.mockReset();
  authenticateTemporaryPollVoterMock.mockReset();
  markPollInviteOpenedMock.mockReset();
  verifyPasswordMock.mockReset();
  writeSessionCookieMock.mockReset();
});

function makeRequest(fields: Record<string, string>) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: "http://localhost"
    },
    body: new URLSearchParams(fields)
  });
}

function makeJsonRequest(body: Record<string, string>) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://vote.example.com",
      "x-forwarded-host": "vote.example.com",
      "x-forwarded-proto": "https"
    },
    body: JSON.stringify(body)
  });
}

describe("login route", () => {
  it("honors a safe next path after login", async () => {
    findUniqueMock.mockResolvedValue({
      id: "user_1",
      nick: "alice",
      passwordHash: "hash",
      role: "USER",
      status: "ACTIVE"
    });
    verifyPasswordMock.mockResolvedValue(true);

    const response = await POST(
      makeRequest({
        nick: "alice",
        password: "secret",
        next: "/polls/custom?tab=1"
      }) as never
    );

    const location = new URL(response.headers.get("location") ?? "");

    expect(location.pathname).toBe("/polls/custom");
    expect(location.search).toBe("?tab=1");
    expect(writeSessionCookieMock).toHaveBeenCalledOnce();
    expect(writeSessionCookieMock).toHaveBeenCalledWith({
      subjectType: "user",
      userId: "user_1",
      nick: "alice",
      role: "USER"
    });
    expect(markPollInviteOpenedMock).toHaveBeenCalledWith({
      pollId: "custom",
      userId: "user_1"
    });
  });

  it("falls back to the role destination for unsafe next values", async () => {
    findUniqueMock.mockResolvedValue({
      id: "user_1",
      nick: "admin",
      passwordHash: "hash",
      role: "ADMIN",
      status: "ACTIVE"
    });
    verifyPasswordMock.mockResolvedValue(true);

    const response = await POST(
      makeRequest({
        nick: "admin",
        password: "secret",
        next: "https://evil.example"
      }) as never
    );

    expect(new URL(response.headers.get("location") ?? "").pathname).toBe(
      "/admin/polls"
    );
  });

  it("authenticates temporary poll voters when next targets a poll", async () => {
    findUniqueMock.mockResolvedValue(null);
    authenticateTemporaryPollVoterMock.mockResolvedValue({
      id: "access_1",
      pollId: "poll_1",
      nick: "voter01"
    });

    const response = await POST(
      makeRequest({
        nick: "voter01",
        password: "TEMP-PASS-01",
        next: "/polls/poll_1"
      }) as never
    );

    const location = new URL(response.headers.get("location") ?? "");

    expect(location.pathname).toBe("/polls/poll_1");
    expect(authenticateTemporaryPollVoterMock).toHaveBeenCalledWith({
      pollId: "poll_1",
      nick: "voter01",
      password: "TEMP-PASS-01"
    });
    expect(writeSessionCookieMock).toHaveBeenCalledWith({
      subjectType: "poll_voter_access",
      userId: "",
      pollVoterAccessId: "access_1",
      pollId: "poll_1",
      nick: "voter01",
      role: "VOTER_TEMP"
    });
    expect(markPollInviteOpenedMock).toHaveBeenCalledWith({
      pollId: "poll_1",
      pollVoterAccessId: "access_1"
    });
  });

  it("falls back to temporary poll auth when the permanent password is invalid", async () => {
    findUniqueMock.mockResolvedValue({
      id: "user_1",
      nick: "voter01",
      passwordHash: "hash",
      role: "USER",
      status: "ACTIVE"
    });
    verifyPasswordMock.mockResolvedValue(false);
    authenticateTemporaryPollVoterMock.mockResolvedValue({
      id: "access_1",
      pollId: "poll_1",
      nick: "voter01"
    });

    const response = await POST(
      makeRequest({
        nick: "voter01",
        password: "TEMP-PASS-01",
        next: "/polls/poll_1"
      }) as never
    );

    expect(new URL(response.headers.get("location") ?? "").pathname).toBe(
      "/polls/poll_1"
    );
    expect(authenticateTemporaryPollVoterMock).toHaveBeenCalledOnce();
  });

  it("blocks disabled users from logging in", async () => {
    findUniqueMock.mockResolvedValue({
      id: "user_1",
      nick: "alice",
      passwordHash: "hash",
      role: "USER",
      status: "DISABLED"
    });

    const response = await POST(
      makeRequest({
        nick: "alice",
        password: "secret",
        next: "/polls"
      }) as never
    );

    const location = new URL(response.headers.get("location") ?? "");

    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("1");
    expect(verifyPasswordMock).not.toHaveBeenCalled();
    expect(authenticateTemporaryPollVoterMock).not.toHaveBeenCalled();
    expect(writeSessionCookieMock).not.toHaveBeenCalled();
  });

  it("accepts JSON payloads and redirects through the forwarded host", async () => {
    findUniqueMock.mockResolvedValue({
      id: "user_1",
      nick: "admin",
      passwordHash: "hash",
      role: "ADMIN",
      status: "ACTIVE"
    });
    verifyPasswordMock.mockResolvedValue(true);

    const response = await POST(
      makeJsonRequest({
        nick: "admin",
        password: "secret"
      }) as never
    );

    const location = new URL(response.headers.get("location") ?? "");

    expect(location.origin).toBe("https://vote.example.com");
    expect(location.pathname).toBe("/admin/polls");
    expect(writeSessionCookieMock).toHaveBeenCalledOnce();
  });

  it("rejects login attempts from an untrusted origin", async () => {
    const response = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          origin: "https://evil.example"
        },
        body: new URLSearchParams({
          nick: "alice",
          password: "secret",
          next: "/polls"
        })
      }) as never
    );

    const location = new URL(response.headers.get("location") ?? "");

    expect(response.status).toBe(303);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("forbidden_origin");
    expect(writeSessionCookieMock).not.toHaveBeenCalled();
  });

  it("redirects with a service error when the database is not configured", async () => {
    const originalDatabaseUrl = process.env.DATABASE_URL;

    delete process.env.DATABASE_URL;

    const response = await POST(
      makeRequest({
        nick: "alice",
        password: "secret",
        next: "/polls"
      }) as never
    );

    if (originalDatabaseUrl) {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }

    const location = new URL(response.headers.get("location") ?? "");

    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("service_unavailable");
    expect(location.searchParams.get("next")).toBe("/polls");
    expect(findUniqueMock).not.toHaveBeenCalled();
    expect(writeSessionCookieMock).not.toHaveBeenCalled();
  });
});
