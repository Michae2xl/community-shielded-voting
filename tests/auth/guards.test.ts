import { describe, expect, it } from "vitest";
import { canManagePolls, sessionPayloadSchema } from "@/lib/auth/guards";

describe("auth guards", () => {
  it("allows admins to manage polls", () => {
    expect(canManagePolls("ADMIN")).toBe(true);
  });

  it("blocks users from managing polls", () => {
    expect(canManagePolls("USER")).toBe(false);
  });

  it("parses an admin session payload", () => {
    expect(
      sessionPayloadSchema.parse({
        subjectType: "user",
        userId: "user_123",
        nick: "alice",
        role: "ADMIN"
      })
    ).toEqual({
      subjectType: "user",
      userId: "user_123",
      nick: "alice",
      role: "ADMIN"
    });
  });

  it("parses a temporary poll voter session payload", () => {
    expect(
      sessionPayloadSchema.parse({
        subjectType: "poll_voter_access",
        userId: "",
        pollVoterAccessId: "access_123",
        pollId: "poll_123",
        nick: "voter01",
        role: "VOTER_TEMP"
      })
    ).toEqual({
      subjectType: "poll_voter_access",
      userId: "",
      pollVoterAccessId: "access_123",
      pollId: "poll_123",
      nick: "voter01",
      role: "VOTER_TEMP"
    });
  });
});
