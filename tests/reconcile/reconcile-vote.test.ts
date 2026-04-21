import { describe, expect, it } from "vitest";

import { reconcileReceipt } from "@/lib/services/reconcile";

describe("reconcileReceipt", () => {
  it("confirms a valid vote", () => {
    const result = reconcileReceipt({
      pollStatus: "OPEN",
      expectedOption: "A",
      amountZat: 10000n,
      minimumAmountZat: 10000n,
      memo: "A",
      alreadyConfirmed: false
    });

    expect(result.status).toBe("CONFIRMED");
  });

  it("rejects wrong memo", () => {
    const result = reconcileReceipt({
      pollStatus: "OPEN",
      expectedOption: "A",
      amountZat: 10000n,
      minimumAmountZat: 10000n,
      memo: "B",
      alreadyConfirmed: false
    });

    expect(result.status).toBe("REJECTED");
    expect(result.rejectionReason).toMatch(/memo/i);
  });

  it("ignores duplicates after the first confirmed vote", () => {
    const result = reconcileReceipt({
      pollStatus: "OPEN",
      expectedOption: "A",
      amountZat: 10000n,
      minimumAmountZat: 10000n,
      memo: "A",
      alreadyConfirmed: true
    });

    expect(result.status).toBe("DUPLICATE_IGNORED");
  });
});
