import { describe, expect, it } from "vitest";
import { parsePollVoterLines } from "@/lib/domain/poll-voters";

describe("parsePollVoterLines", () => {
  it("parses one voter per line as nick,email", () => {
    expect(
      parsePollVoterLines("voter01,voter01@example.com\nalice,alice@example.com")
    ).toEqual([
      { nick: "voter01", email: "voter01@example.com" },
      { nick: "alice", email: "alice@example.com" }
    ]);
  });

  it("rejects duplicate nick or email inside the same poll input", () => {
    expect(() =>
      parsePollVoterLines("voter01,voter01@example.com\nvoter01,other@example.com")
    ).toThrow(/duplicate voter/i);

    expect(() =>
      parsePollVoterLines("voter01,voter01@example.com\nalice,voter01@example.com")
    ).toThrow(/duplicate voter/i);
  });

  it("rejects malformed rows", () => {
    expect(() => parsePollVoterLines("voter01")).toThrow(/invalid voter row/i);
    expect(() => parsePollVoterLines("voter01,not-an-email")).toThrow(/invalid voter row/i);
  });
});
