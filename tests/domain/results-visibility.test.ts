import { describe, expect, it } from "vitest";
import { canRevealPollResults } from "@/lib/domain/results-visibility";

describe("canRevealPollResults", () => {
  it("hides results while an open poll is still inside the voting window", () => {
    expect(
      canRevealPollResults({
        status: "OPEN",
        closesAt: new Date("2026-05-01T00:00:00.000Z")
      })
    ).toBe(false);
  });

  it("keeps results hidden after close time until lifecycle closes the poll", () => {
    expect(
      canRevealPollResults({
        status: "OPEN",
        closesAt: new Date("2026-04-30T00:00:00.000Z")
      })
    ).toBe(false);
  });

  it("reveals results for closed polls", () => {
    expect(
      canRevealPollResults({
        status: "CLOSED",
        closesAt: new Date("2026-05-01T00:00:00.000Z")
      })
    ).toBe(true);
  });
});
