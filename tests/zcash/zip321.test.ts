import { describe, expect, it } from "vitest";
import { buildZip321Uri, encodeMemoForZip321 } from "@/lib/zcash/zip321";

describe("zip321", () => {
  it("encodes single-character memos with the expected zcash encoding", () => {
    expect(encodeMemoForZip321("A")).toBe("QQ");
    expect(encodeMemoForZip321("E")).toBe("RQ");
  });

  it("builds a zcash URI with amount and memo", () => {
    expect(
      buildZip321Uri({
        address: "utest1example",
        amountZec: "0.0001",
        memo: "A"
      })
    ).toBe("zcash:utest1example?amount=0.0001&memo=QQ");
  });
});
