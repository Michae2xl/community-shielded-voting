export const DEFAULT_VOTE_MODEL = "SINGLE_CHOICE" as const;
export const DEFAULT_QUORUM_PERCENT = 40;
export const DEFAULT_PASSING_THRESHOLD_PERCENT = 67;

export type PollVoteModel = typeof DEFAULT_VOTE_MODEL;
export type GovernanceOutcome =
  | "PENDING"
  | "PASSED"
  | "REJECTED"
  | "QUORUM_NOT_MET";

export type GovernanceRulesInput = {
  voteModel?: string | null;
  quorumPercent?: number | null;
  passingThresholdPercent?: number | null;
};

export type SingleChoiceOutcomeInput = GovernanceRulesInput & {
  isClosed: boolean;
  totalEligible: number;
  totalConfirmed: number;
  countA: number;
};

export function normalizeGovernanceRules(input: GovernanceRulesInput = {}) {
  return {
    voteModel: DEFAULT_VOTE_MODEL,
    quorumPercent: input.quorumPercent ?? DEFAULT_QUORUM_PERCENT,
    passingThresholdPercent:
      input.passingThresholdPercent ?? DEFAULT_PASSING_THRESHOLD_PERCENT
  };
}

export function formatGovernanceRuleMemoSegment(input: GovernanceRulesInput = {}) {
  const rules = normalizeGovernanceRules(input);

  return `${rules.voteModel}|Q${rules.quorumPercent}|T${rules.passingThresholdPercent}`;
}

function roundedPercent(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 0;
  }

  return Math.round((numerator / denominator) * 100);
}

export function calculateSingleChoiceOutcome(input: SingleChoiceOutcomeInput) {
  const rules = normalizeGovernanceRules(input);
  const turnoutPercent = roundedPercent(input.totalConfirmed, input.totalEligible);
  const approvalPercent = roundedPercent(input.countA, input.totalConfirmed);
  const quorumMet =
    input.totalEligible > 0 &&
    input.totalConfirmed * 100 >= input.totalEligible * rules.quorumPercent;
  const thresholdMet =
    input.totalConfirmed > 0 &&
    input.countA * 100 >=
      input.totalConfirmed * rules.passingThresholdPercent;
  const outcome: GovernanceOutcome = !input.isClosed
    ? "PENDING"
    : !quorumMet
      ? "QUORUM_NOT_MET"
      : thresholdMet
        ? "PASSED"
        : "REJECTED";

  return {
    outcome,
    quorumMet,
    thresholdMet,
    turnoutPercent,
    approvalPercent,
    quorumPercent: rules.quorumPercent,
    passingThresholdPercent: rules.passingThresholdPercent,
    voteModel: rules.voteModel
  };
}

export function presentGovernanceOutcome(outcome: GovernanceOutcome) {
  switch (outcome) {
    case "PASSED":
      return "Passed";
    case "REJECTED":
      return "Rejected";
    case "QUORUM_NOT_MET":
      return "Quorum not met";
    case "PENDING":
      return "Pending";
  }
}
