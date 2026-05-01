import { VoteReceiptStatus, type PollStatus } from "@prisma/client";

export function reconcileReceipt(input: {
  pollStatus: PollStatus;
  expectedOption: string;
  amountZat: bigint;
  minimumAmountZat: bigint;
  memo: string;
  alreadyConfirmed: boolean;
}) {
  if (input.alreadyConfirmed) {
    return {
      status: VoteReceiptStatus.DUPLICATE_IGNORED,
      rejectionReason: "ticket already has a confirmed vote"
    };
  }

  if (input.pollStatus !== "OPEN") {
    return {
      status: VoteReceiptStatus.REJECTED,
      rejectionReason: "poll is not open"
    };
  }

  if (input.memo !== input.expectedOption) {
    return {
      status: VoteReceiptStatus.REJECTED,
      rejectionReason: "memo does not match vote request option"
    };
  }

  return {
    status: VoteReceiptStatus.CONFIRMED,
    rejectionReason: null
  };
}
