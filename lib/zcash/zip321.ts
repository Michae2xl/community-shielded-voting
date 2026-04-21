export function encodeMemoForZip321(memo: string) {
  return Buffer.from(memo, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function buildZip321Uri(input: {
  address: string;
  amountZec: string;
  memo: string;
}) {
  const params = new URLSearchParams({
    amount: input.amountZec,
    memo: encodeMemoForZip321(input.memo)
  });

  return `zcash:${input.address}?${params.toString()}`;
}
