import { describe, expect, it } from "vitest";
import { parsePollVoterLines } from "@/lib/domain/poll-voters";

describe("parsePollVoterLines", () => {
  it("parses one voter per line as nick,email", () => {
    expect(
      parsePollVoterLines("michae2xl,michaelguima@proton.me\nalice,alice@example.com")
    ).toEqual([
      { nick: "michae2xl", email: "michaelguima@proton.me" },
      { nick: "alice", email: "alice@example.com" }
    ]);
  });

  it("rejects duplicate nick or email inside the same poll input", () => {
    expect(() =>
      parsePollVoterLines("michae2xl,michaelguima@proton.me\nmichae2xl,other@example.com")
    ).toThrow(/duplicate voter/i);

    expect(() =>
      parsePollVoterLines("michae2xl,michaelguima@proton.me\nalice,michaelguima@proton.me")
    ).toThrow(/duplicate voter/i);
  });

  it("rejects malformed rows", () => {
    expect(() => parsePollVoterLines("michae2xl")).toThrow(/invalid voter row/i);
    expect(() => parsePollVoterLines("michae2xl,not-an-email")).toThrow(/invalid voter row/i);
  });
});
