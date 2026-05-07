type SignalVoteReceiptMessageInput = {
  pollQuestion: string;
  voterNick: string;
  pollId: string;
  receiptPublicId: string;
  txid: string;
  confirmedAt: string;
  portalUrl: string;
};

export function buildSignalVoteReceiptMessage(input: SignalVoteReceiptMessageInput) {
  return [
    "Shielded voting by Zcash",
    "",
    "Vote confirmed",
    "",
    input.pollQuestion,
    "",
    `Voter ID: ${input.voterNick}`,
    `Poll ID: ${input.pollId}`,
    `Receipt ID: ${input.receiptPublicId}`,
    `Confirmed at: ${input.confirmedAt}`,
    `Txid: ${input.txid}`,
    "",
    "Open your receipt:",
    input.portalUrl
  ].join("\n");
}
