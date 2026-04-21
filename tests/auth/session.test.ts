import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, findUniqueMock, pollVoterAccessFindUniqueMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  findUniqueMock: vi.fn(),
  pollVoterAccessFindUniqueMock: vi.fn()
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: findUniqueMock
    },
    pollVoterAccess: {
      findUnique: pollVoterAccessFindUniqueMock
    }
  }
}));

import { readSession } from "@/lib/auth/session";
import {
  createSessionToken,
  verifySessionToken
} from "@/lib/auth/session-token";

beforeEach(() => {
  cookiesMock.mockReset();
  findUniqueMock.mockReset();
  pollVoterAccessFindUniqueMock.mockReset();
});

describe("session helpers", () => {
  it("verifies signed session tokens", async () => {
    const token = await createSessionToken({
      subjectType: "user",
      userId: "user_1",
      nick: "alice",
      role: "ADMIN"
    });

    await expect(verifySessionToken(token)).resolves.toEqual({
      subjectType: "user",
      userId: "user_1",
      nick: "alice",
      role: "ADMIN"
    });
    await expect(verifySessionToken("bad-token")).resolves.toBeNull();
  });

  it("returns null for disabled users when reading sessions", async () => {
    const token = await createSessionToken({
      subjectType: "user",
      userId: "user_1",
      nick: "alice",
      role: "ADMIN"
    });

    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: token })
    });
    findUniqueMock.mockResolvedValue({
      id: "user_1",
      nick: "alice",
      role: "ADMIN",
      status: "DISABLED"
    });

    await expect(readSession()).resolves.toBeNull();
  });

  it("reads active temporary poll voter sessions", async () => {
    const token = await createSessionToken({
      subjectType: "poll_voter_access",
      userId: "",
      pollVoterAccessId: "access_1",
      pollId: "poll_1",
      nick: "michae2xl",
      role: "VOTER_TEMP"
    });

    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: token })
    });
    pollVoterAccessFindUniqueMock.mockResolvedValue({
      id: "access_1",
      pollId: "poll_1",
      nick: "michae2xl",
      status: "ACTIVE",
      expiresAt: new Date("2099-04-22T22:56:36.000Z")
    });

    await expect(readSession()).resolves.toEqual({
      subjectType: "poll_voter_access",
      userId: "",
      pollVoterAccessId: "access_1",
      pollId: "poll_1",
      nick: "michae2xl",
      role: "VOTER_TEMP"
    });
  });

  it("returns null for expired temporary poll voter sessions", async () => {
    const token = await createSessionToken({
      subjectType: "poll_voter_access",
      userId: "",
      pollVoterAccessId: "access_1",
      pollId: "poll_1",
      nick: "michae2xl",
      role: "VOTER_TEMP"
    });

    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: token })
    });
    pollVoterAccessFindUniqueMock.mockResolvedValue({
      id: "access_1",
      pollId: "poll_1",
      nick: "michae2xl",
      status: "ACTIVE",
      expiresAt: new Date("2020-04-22T22:56:36.000Z")
    });

    await expect(readSession()).resolves.toBeNull();
  });
});
