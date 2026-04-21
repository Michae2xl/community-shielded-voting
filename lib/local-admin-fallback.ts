import type { OptionLetter } from "@/lib/domain/options";

export type LocalAdminFallbackPoll = {
  pollId: string;
  question: string;
  status: string;
  optionLabels: Record<OptionLetter, string>;
};

const LOCAL_ADMIN_FALLBACK_POLLS: Record<string, LocalAdminFallbackPoll> = {
  cmo7hg2n60001xzi7e84wquls: {
    pollId: "cmo7hg2n60001xzi7e84wquls",
    question: "Which path should we follow for the shielded portal test?",
    status: "OPEN",
    optionLabels: {
      A: "Approve full rollout",
      B: "Approve controlled pilot",
      C: "Request additional review",
      D: "Reject proposal",
      E: "Abstain"
    }
  }
};

export function getLocalAdminFallbackPoll(
  pollId: string
): LocalAdminFallbackPoll {
  return (
    LOCAL_ADMIN_FALLBACK_POLLS[pollId] ?? {
      pollId,
      question: "Collector validation fallback",
      status: "LIVE",
      optionLabels: {
        A: "Option A",
        B: "Option B",
        C: "Option C",
        D: "Option D",
        E: "Option E"
      }
    }
  );
}
