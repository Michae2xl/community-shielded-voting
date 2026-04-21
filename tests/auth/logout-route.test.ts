import { beforeEach, describe, expect, it, vi } from "vitest";

const { clearSessionCookieMock } = vi.hoisted(() => ({
  clearSessionCookieMock: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({
  clearSessionCookie: clearSessionCookieMock
}));

import { POST } from "@/app/api/auth/logout/route";

beforeEach(() => {
  clearSessionCookieMock.mockReset();
});

describe("logout route", () => {
  it("clears the session cookie for trusted same-origin requests", async () => {
    const response = await POST(
      new Request("http://localhost/api/auth/logout", {
        method: "POST",
        headers: {
          origin: "http://localhost"
        }
      }) as never
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/login");
    expect(clearSessionCookieMock).toHaveBeenCalledOnce();
  });

  it("rejects logout requests from an untrusted origin", async () => {
    const response = await POST(
      new Request("http://localhost/api/auth/logout", {
        method: "POST",
        headers: {
          origin: "https://evil.example"
        }
      }) as never
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "forbidden_origin"
    });
    expect(clearSessionCookieMock).not.toHaveBeenCalled();
  });
});
