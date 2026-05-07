type SignalPollInviteMessageInput = {
  pollQuestion: string;
  voterNick: string;
  inviteUrl: string;
  opensAt: string;
  closesAt: string;
  pollId: string;
};

export function buildSignalPollInviteMessage(input: SignalPollInviteMessageInput) {
  return [
    "Shielded voting by Zcash",
    "",
    input.pollQuestion,
    "",
    `Voter ID: ${input.voterNick}`,
    `Poll ID: ${input.pollId}`,
    `Voting window: ${input.opensAt} to ${input.closesAt}`,
    "",
    "Open your one-time voting link:",
    input.inviteUrl,
    "",
    "This link creates your poll session. No password is sent in this message."
  ].join("\n");
}
