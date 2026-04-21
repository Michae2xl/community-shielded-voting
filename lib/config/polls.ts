const DEFAULT_POLL_FEE_ZAT_STRING = process.env.ZCAP_DEFAULT_FEE_ZAT ?? "10000";

export function getDefaultPollFeeZat() {
  if (!/^\d+$/.test(DEFAULT_POLL_FEE_ZAT_STRING)) {
    throw new Error("ZCAP_DEFAULT_FEE_ZAT must be an integer string");
  }

  return BigInt(DEFAULT_POLL_FEE_ZAT_STRING);
}
