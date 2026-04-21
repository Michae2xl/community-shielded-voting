import { describe, expect, it } from "vitest";
import { OPTION_LETTERS } from "@/lib/domain/options";
import { buildAnchorMemo, questionHash } from "@/lib/domain/polls";
import { buildTicketHash } from "@/lib/domain/tickets";

describe("poll domain primitives", () => {
  it("builds a deterministic anchor memo", () => {
    const hash = questionHash("  Should we adopt the proposal?  ");

    expect(
      buildAnchorMemo({
        pollId: "poll_123",
        questionHash: hash,
        opensAt: "2026-05-01T10:00:00.000Z",
        closesAt: "2026-05-03T10:00:00.000Z"
      })
    ).toBe(
      `POLL|v1|poll_123|${hash}|2026-05-01T10:00:00.000Z|2026-05-03T10:00:00.000Z`
    );
  });

  it("hashes the normalized question deterministically", () => {
    expect(questionHash("  Should we adopt the proposal?  ")).toBe(
      "16183e6a5e43a2a6186f4ed42204d9708dbaf19a0dd5bb3474ea28d89301005f"
    );
  });

  it("exposes the supported option letters", () => {
    expect(OPTION_LETTERS).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("builds a ticket hash without leaking the secret", () => {
    const ticketHash = buildTicketHash("ticket_123", "super-secret-token");

    expect(ticketHash).toBe(
      "5a8d88266402d4db670f413feb4fef1df49df3dec09a179d49a62ded5abf6c42"
    );
    expect(ticketHash).toHaveLength(64);
    expect(ticketHash).not.toContain("super-secret-token");
  });
});
