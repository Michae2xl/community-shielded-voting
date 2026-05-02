import { describe, expect, it } from "vitest";
import {
  calculateSingleChoiceOutcome,
  formatGovernanceRuleMemoSegment
} from "@/lib/domain/governance";

describe("single-choice governance outcome", () => {
  it("passes when quorum and approval threshold are both met", () => {
    expect(
      calculateSingleChoiceOutcome({
        isClosed: true,
        totalEligible: 100,
        totalConfirmed: 40,
        countA: 27,
        quorumPercent: 40,
        passingThresholdPercent: 67
      })
    ).toMatchObject({
      outcome: "PASSED",
      quorumMet: true,
      thresholdMet: true,
      turnoutPercent: 40,
      approvalPercent: 68
    });
  });

  it("rejects when quorum is met but approval is below threshold", () => {
    expect(
      calculateSingleChoiceOutcome({
        isClosed: true,
        totalEligible: 18,
        totalConfirmed: 15,
        countA: 8,
        quorumPercent: 40,
        passingThresholdPercent: 67
      })
    ).toMatchObject({
      outcome: "REJECTED",
      quorumMet: true,
      thresholdMet: false,
      turnoutPercent: 83,
      approvalPercent: 53
    });
  });

  it("marks closed polls invalid when quorum is not met", () => {
    expect(
      calculateSingleChoiceOutcome({
        isClosed: true,
        totalEligible: 100,
        totalConfirmed: 39,
        countA: 39,
        quorumPercent: 40,
        passingThresholdPercent: 67
      })
    ).toMatchObject({
      outcome: "QUORUM_NOT_MET",
      quorumMet: false,
      thresholdMet: true
    });
  });

  it("keeps open polls pending", () => {
    expect(
      calculateSingleChoiceOutcome({
        isClosed: false,
        totalEligible: 100,
        totalConfirmed: 100,
        countA: 100
      }).outcome
    ).toBe("PENDING");
  });

  it("formats the immutable rule segment for the poll anchor", () => {
    expect(
      formatGovernanceRuleMemoSegment({
        quorumPercent: 40,
        passingThresholdPercent: 67
      })
    ).toBe("SINGLE_CHOICE|Q40|T67");
  });
});
