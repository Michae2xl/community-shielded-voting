import { createHash } from "node:crypto";
import type { PollStatus } from "@prisma/client";
import { normalizeOptionLabel } from "@/lib/domain/options";

export const UNPUBLISHED_POLL_STATUSES: PollStatus[] = ["DRAFT", "ANCHORING"];

export function normalizeQuestion(question: string): string {
  return question.trim();
}

export function questionHash(question: string, optionLabels: string[] = []): string {
  const normalizedQuestion = normalizeQuestion(question);
  const normalizedLabels = optionLabels
    .map((label) => normalizeOptionLabel(label))
    .filter(Boolean);

  const payload =
    normalizedLabels.length > 0
      ? JSON.stringify({
          question: normalizedQuestion,
          optionLabels: normalizedLabels
        })
      : normalizedQuestion;

  return createHash("sha256").update(payload).digest("hex");
}

export function buildAnchorMemo(input: {
  pollId: string;
  questionHash: string;
  opensAt: string;
  closesAt: string;
}): string {
  return `POLL|v1|${input.pollId}|${input.questionHash}|${input.opensAt}|${input.closesAt}`;
}
