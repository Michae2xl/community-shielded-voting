import { beforeEach, describe, expect, it, vi } from "vitest";

const { userFindUniqueMock, pollVoterAccessFindUniqueMock } = vi.hoisted(() => ({
  userFindUniqueMock: vi.fn(),
  pollVoterAccessFindUniqueMock: vi.fn()
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: userFindUniqueMock
    },
    pollVoterAccess: {
      findUnique: pollVoterAccessFindUniqueMock
    }
  }
}));

import { middleware } from "@/middleware";
import { SESSION_COOKIE_NAME } from "@/lib/auth/guards";
import { createSessionToken } from "@/lib/auth/session-token";

function makeRequest(
  pathname: string,
  token?: string,
  headers: Record<string, string> = {}
) {
  const url = new URL(pathname, "http://localhost");
  const headerMap = new Headers(headers);

  return {
    url: url.toString(),
    nextUrl: url,
    headers: {
      get(name: string) {
        return headerMap.get(name);
      }
    },
    cookies: {
      get(name: string) {
        if (name !== SESSION_COOKIE_NAME || !token) {
          return undefined;
        }

        return { value: token };
      }
    }
  } as never;
}

beforeEach(() => {
  userFindUniqueMock.mockReset();
  pollVoterAccessFindUniqueMock.mockReset();
});

describe("middleware auth", () => {
  it("redirects invalid tokens to login on protected poll routes", async () => {
    const response = await middleware(makeRequest("/polls/poll_1", "not-a-token"));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe(
      "/login"
    );
  });

  it("allows the public polls board without a session", async () => {
    const response = await middleware(makeRequest("/polls"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("redirects now-disabled users to login", async () => {
    const token = await createSessionToken({
      subjectType: "user",
      userId: "user_1",
      nick: "alice",
      role: "USER"
    });

    userFindUniqueMock.mockResolvedValue({
      id: "user_1",
      nick: "alice",
      role: "USER",
      status: "DISABLED"
    });

    const response = await middleware(makeRequest("/polls/poll_1", token));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe(
      "/login"
    );
  });

  it("allows valid sessions on polls routes", async () => {
    const token = await createSessionToken({
      subjectType: "user",
      userId: "user_1",
      nick: "alice",
      role: "USER"
    });

    userFindUniqueMock.mockResolvedValue({
      id: "user_1",
      nick: "alice",
      role: "USER",
      status: "ACTIVE"
    });

    const response = await middleware(makeRequest("/polls", token));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("redirects downgraded admins away from admin routes", async () => {
    const token = await createSessionToken({
      subjectType: "user",
      userId: "user_1",
      nick: "alice",
      role: "ADMIN"
    });

    userFindUniqueMock.mockResolvedValue({
      id: "user_1",
      nick: "alice",
      role: "USER",
      status: "ACTIVE"
    });

    const response = await middleware(makeRequest("/admin/polls", token));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe(
      "/polls"
    );
  });

  it("allows admin sessions on admin routes", async () => {
    const token = await createSessionToken({
      subjectType: "user",
      userId: "user_1",
      nick: "alice",
      role: "ADMIN"
    });

    userFindUniqueMock.mockResolvedValue({
      id: "user_1",
      nick: "alice",
      role: "ADMIN",
      status: "ACTIVE"
    });

    const response = await middleware(makeRequest("/admin/polls", token));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("redirects to login with a service error when the database URL is missing", async () => {
    const token = await createSessionToken({
      subjectType: "user",
      userId: "user_1",
      nick: "alice",
      role: "USER"
    });
    const originalDatabaseUrl = process.env.DATABASE_URL;

    delete process.env.DATABASE_URL;

    const response = await middleware(makeRequest("/polls/poll_1", token));

    if (originalDatabaseUrl) {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }

    const location = new URL(response.headers.get("location") ?? "");

    expect(response.status).toBe(307);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("service_unavailable");
    expect(userFindUniqueMock).not.toHaveBeenCalled();
  });

  it("redirects to login with a service error when the database lookup throws", async () => {
    const token = await createSessionToken({
      subjectType: "user",
      userId: "user_1",
      nick: "alice",
      role: "USER"
    });

    userFindUniqueMock.mockRejectedValue(new Error("P1001"));

    const response = await middleware(makeRequest("/polls/poll_1", token));
    const location = new URL(response.headers.get("location") ?? "");

    expect(response.status).toBe(307);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("service_unavailable");
  });

  it("allows active temporary poll voter sessions on poll routes", async () => {
    const token = await createSessionToken({
      subjectType: "poll_voter_access",
      userId: "",
      pollVoterAccessId: "access_1",
      pollId: "poll_1",
      nick: "voter01",
      role: "VOTER_TEMP"
    });

    pollVoterAccessFindUniqueMock.mockResolvedValue({
      id: "access_1",
      pollId: "poll_1",
      status: "ACTIVE",
      expiresAt: new Date("2099-04-22T22:56:36.000Z")
    });

    const response = await middleware(makeRequest("/polls/poll_1", token));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("redirects temporary poll voter sessions away from admin routes", async () => {
    const token = await createSessionToken({
      subjectType: "poll_voter_access",
      userId: "",
      pollVoterAccessId: "access_1",
      pollId: "poll_1",
      nick: "voter01",
      role: "VOTER_TEMP"
    });

    pollVoterAccessFindUniqueMock.mockResolvedValue({
      id: "access_1",
      pollId: "poll_1",
      status: "ACTIVE",
      expiresAt: new Date("2099-04-22T22:56:36.000Z")
    });

    const response = await middleware(makeRequest("/admin/polls", token));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe(
      "/polls/poll_1"
    );
  });

  it("builds login redirects from the forwarded public host", async () => {
    const response = await middleware(
      makeRequest("/polls/poll_1", undefined, {
        "x-forwarded-host": "vote.example.com",
        "x-forwarded-proto": "https"
      })
    );

    const location = new URL(response.headers.get("location") ?? "");

    expect(location.origin).toBe("https://vote.example.com");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/polls/poll_1");
  });
});
