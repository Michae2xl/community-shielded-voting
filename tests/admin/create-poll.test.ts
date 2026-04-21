import { beforeEach, describe, expect, it, vi } from "vitest";
import { questionHash } from "@/lib/domain/polls";

const { pollCreateMock } = vi.hoisted(() => ({
  pollCreateMock: vi.fn()
}));

vi.mock("@/lib/db", () => ({
  db: {
    poll: {
      create: pollCreateMock
    }
  }
}));

import {
  createDraftPoll,
  createDraftPollInputSchema
} from "@/lib/services/polls";

beforeEach(() => {
  pollCreateMock.mockReset();
});

describe("createDraftPollInputSchema", () => {
  it("derives the question hash from the submitted question and active option labels", () => {
    const parsed = createDraftPollInputSchema.parse({
      question: "Which option should we fund?",
      opensAt: "2026-05-01T10:00:00.000Z",
        closesAt: "2026-05-03T10:00:00.000Z",
        optionALabel: "Approve",
        optionBLabel: "Reject",
        optionCLabel: "Abstain",
        voters: [{ nick: "voter01", email: "voter01@example.com" }]
      });

    expect(parsed.questionHash).toBe(
      questionHash("Which option should we fund?", ["Approve", "Reject", "Abstain"])
    );
  });

  it("rejects poll windows that close before they open", () => {
    expect(() =>
      createDraftPollInputSchema.parse({
        question: "Which option should we fund?",
        opensAt: "2026-05-03T10:00:00.000Z",
        closesAt: "2026-05-01T10:00:00.000Z",
        optionALabel: "Approve",
        optionBLabel: "Reject",
        voters: [{ nick: "voter01", email: "voter01@example.com" }]
      })
    ).toThrowError(/closesAt must be after opensAt/i);
  });
});

describe("createDraftPoll", () => {
  it("creates temporary voter access rows on draft poll creation", async () => {
    pollCreateMock.mockResolvedValue({ id: "poll_1" });

    await createDraftPoll(
      {
        question: "Should the next shielded rollout proceed on mainnet?",
        opensAt: "2026-04-21T12:00:00.000Z",
        closesAt: "2026-04-22T12:00:00.000Z",
        optionALabel: "Approve",
        optionBLabel: "Reject",
        optionCLabel: "",
        optionDLabel: "",
        optionELabel: "",
        voters: [{ nick: "voter01", email: "voter01@example.com" }]
      },
      "admin_1"
    );

    expect(pollCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          optionALabel: "Approve",
          optionBLabel: "Reject",
          optionCLabel: undefined,
          feeZat: 10000n,
          voterAccesses: {
            create: [
              expect.objectContaining({
                nick: "voter01",
                email: "voter01@example.com",
                inviteToken: expect.any(String),
                expiresAt: new Date("2026-04-22T12:00:00.000Z")
              })
            ]
          }
        })
      })
    );
  });

  it("rejects duplicate voters before insert", async () => {
    await expect(
      createDraftPoll(
        {
          question: "Should the next shielded rollout proceed on mainnet?",
          opensAt: "2026-04-21T12:00:00.000Z",
          closesAt: "2026-04-22T12:00:00.000Z",
          optionALabel: "Approve",
          optionBLabel: "Reject",
          voters: [
            { nick: "voter01", email: "voter01@example.com" },
            { nick: "voter01", email: "other@example.com" }
          ]
        },
        "admin_1"
      )
    ).rejects.toThrow(/duplicate voter/i);

    expect(pollCreateMock).not.toHaveBeenCalled();
  });
});
