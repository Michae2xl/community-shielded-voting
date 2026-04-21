import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  userFindFirstMock,
  userCreateMock,
  hashPasswordMock,
  writeSessionCookieMock
} = vi.hoisted(() => ({
  userFindFirstMock: vi.fn(),
  userCreateMock: vi.fn(),
  hashPasswordMock: vi.fn(),
  writeSessionCookieMock: vi.fn()
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findFirst: userFindFirstMock,
      create: userCreateMock
    }
  }
}));

vi.mock("@/lib/auth/password", () => ({
  hashPassword: hashPasswordMock
}));

vi.mock("@/lib/auth/session", () => ({
  writeSessionCookie: writeSessionCookieMock
}));

import { POST } from "@/app/api/auth/signup/route";

beforeEach(() => {
  userFindFirstMock.mockReset();
  userCreateMock.mockReset();
  hashPasswordMock.mockReset();
  writeSessionCookieMock.mockReset();
});

function makeRequest(fields: Record<string, string>) {
  return new Request("http://localhost/api/auth/signup", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: "http://localhost"
    },
    body: new URLSearchParams(fields)
  });
}

describe("signup route", () => {
  it("creates a creator account and redirects to the owned poll directory", async () => {
    userFindFirstMock.mockResolvedValue(null);
    hashPasswordMock.mockResolvedValue("hashed-password");
    userCreateMock.mockResolvedValue({
      id: "user_1",
      nick: "creator01",
      role: "CREATOR"
    });

    const response = await POST(
      makeRequest({
        userId: "creator01",
        email: "creator@example.com",
        password: "super-secret-1"
      }) as never
    );

    expect(userFindFirstMock).toHaveBeenCalledWith({
      where: {
        OR: [{ nick: "creator01" }, { email: "creator@example.com" }]
      },
      select: {
        nick: true,
        email: true
      }
    });
    expect(userCreateMock).toHaveBeenCalledWith({
      data: {
        nick: "creator01",
        email: "creator@example.com",
        passwordHash: "hashed-password",
        role: "CREATOR",
        status: "ACTIVE"
      }
    });
    expect(writeSessionCookieMock).toHaveBeenCalledWith({
      subjectType: "user",
      userId: "user_1",
      nick: "creator01",
      role: "CREATOR"
    });
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe(
      "/admin/polls"
    );
  });

  it("rejects duplicate user IDs", async () => {
    userFindFirstMock.mockResolvedValue({
      nick: "creator01",
      email: "someone@example.com"
    });

    const response = await POST(
      makeRequest({
        userId: "creator01",
        email: "creator@example.com",
        password: "super-secret-1"
      }) as never
    );

    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/signup");
    expect(location.searchParams.get("error")).toBe("user_id_taken");
    expect(userCreateMock).not.toHaveBeenCalled();
  });

  it("rejects signup attempts from an untrusted origin", async () => {
    const response = await POST(
      new Request("http://localhost/api/auth/signup", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          origin: "https://evil.example"
        },
        body: new URLSearchParams({
          userId: "creator01",
          email: "creator@example.com",
          password: "super-secret-1"
        })
      }) as never
    );

    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/signup");
    expect(location.searchParams.get("error")).toBe("forbidden_origin");
    expect(userCreateMock).not.toHaveBeenCalled();
  });
});
