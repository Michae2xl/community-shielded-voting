import type { PollStatus } from "@prisma/client";

const RESULT_RELEASE_STATUSES = new Set<PollStatus>([
  "CLOSED",
  "FINALIZED",
  "ARCHIVED"
]);

export type PollResultsVisibilityInput = {
  status: PollStatus;
  closesAt: Date;
};

export function canRevealPollResults(poll: PollResultsVisibilityInput) {
  return RESULT_RELEASE_STATUSES.has(poll.status);
}

export function buildResultsUnavailablePayload(
  poll: PollResultsVisibilityInput
) {
  return {
    error: "RESULTS_NOT_AVAILABLE",
    closesAt: poll.closesAt.toISOString(),
    requiredStatus: "CLOSED_OR_FINALIZED"
  };
}
