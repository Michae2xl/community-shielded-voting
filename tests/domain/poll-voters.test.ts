import { describe, expect, it } from "vitest";
import { parsePollVoterLines } from "@/lib/domain/poll-voters";

describe("parsePollVoterLines", () => {
  it("parses one voter per line as nick,Signal username", () => {
    expect(
      parsePollVoterLines("michae2xl,michae2xl.42\nalice,u:alice_user.99")
    ).toEqual([
      { nick: "michae2xl", signalUsername: "michae2xl.42" },
      { nick: "alice", signalUsername: "alice_user.99" }
    ]);
  });

  it("rejects duplicate nick or Signal username inside the same poll input", () => {
    expect(() =>
      parsePollVoterLines("michae2xl,michae2xl.42\nmichae2xl,other_user.99")
    ).toThrow(/duplicate voter/i);

    expect(() =>
      parsePollVoterLines("michae2xl,michae2xl.42\nalice,u:michae2xl.42")
    ).toThrow(/duplicate voter/i);
  });

  it("rejects malformed rows", () => {
    expect(() => parsePollVoterLines("michae2xl")).toThrow(/invalid voter row/i);
    expect(() => parsePollVoterLines("michae2xl,not-a-signal-id")).toThrow(/invalid voter row/i);
    expect(() => parsePollVoterLines("michae2xl,+15551234567")).toThrow(/invalid voter row/i);
  });
});
