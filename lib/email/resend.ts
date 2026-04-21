import { Resend } from "resend";

type PollInviteEmailInput = {
  to: string;
  subject: string;
  pollQuestion: string;
  voterNick: string;
  loginNick?: string;
  temporaryPassword?: string;
  inviteUrl: string;
  opensAt: string;
  closesAt: string;
  pollId: string;
  userId?: string;
  pollVoterAccessId?: string;
};

type VoteReceiptEmailInput = {
  to: string;
  subject: string;
  voterNick: string;
  pollQuestion: string;
  pollId: string;
  receiptPublicId: string;
  txid: string;
  confirmedAt: string;
  portalUrl: string;
};

function getResendApiKey() {
  return process.env.RESEND_API_KEY ?? "";
}

function getResendFromEmail() {
  return process.env.RESEND_FROM_EMAIL ?? "";
}

export function isEmailDeliveryConfigured() {
  return Boolean(getResendApiKey() && getResendFromEmail());
}

function getResendClient() {
  const apiKey = getResendApiKey();

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  return new Resend(apiKey);
}

function buildInviteHtml(input: PollInviteEmailInput) {
  const credentialBlock = input.temporaryPassword
    ? `
      <div style="margin: 20px 0; padding: 16px; border-radius: 14px; background: #132334; border: 1px solid rgba(201, 180, 122, 0.18);">
        <p style="font-size: 12px; line-height: 1.5; color: #c9b47a; text-transform: uppercase; letter-spacing: 0.16em; margin: 0 0 10px;">Temporary poll access</p>
        <p style="font-size: 14px; line-height: 1.6; color: #d6d1c7; margin: 0 0 6px;"><strong>Login:</strong> ${input.loginNick ?? input.voterNick}</p>
        <p style="font-size: 14px; line-height: 1.6; color: #d6d1c7; margin: 0;"><strong>Temporary password:</strong> ${input.temporaryPassword}</p>
      </div>
    `
    : "";
  const accessCopy = input.temporaryPassword
    ? "Use the temporary login above to enter this poll. These credentials are scoped to this invitation."
    : "You will still sign in with your account before accessing the poll. This link is unique to this poll invitation.";

  return `
    <div style="font-family: Arial, sans-serif; background: #09121d; color: #f3efe7; padding: 24px;">
      <h1 style="font-size: 28px; line-height: 1.1; margin: 0 0 16px;">Shielded voting invite</h1>
      <p style="font-size: 16px; line-height: 1.6; color: #d6d1c7;">Hello ${input.voterNick}, you have been invited to vote in a shielded poll.</p>
      <p style="font-size: 16px; line-height: 1.6; color: #f3efe7;"><strong>Question:</strong> ${input.pollQuestion}</p>
      <p style="font-size: 14px; line-height: 1.6; color: #b6c0ca;">Voting window: ${input.opensAt} to ${input.closesAt}</p>
      ${credentialBlock}
      <p style="margin: 24px 0;">
        <a href="${input.inviteUrl}" style="display: inline-block; background: #c9b47a; color: #09121d; padding: 12px 18px; text-decoration: none; font-weight: 700; border-radius: 10px;">Open voting portal</a>
      </p>
      <p style="font-size: 13px; line-height: 1.6; color: #8f9ba6;">${accessCopy}</p>
    </div>
  `.trim();
}

function buildInviteText(input: PollInviteEmailInput) {
  const lines = [
    `Hello ${input.voterNick}, you have been invited to vote in a shielded poll.`,
    "",
    `Question: ${input.pollQuestion}`,
    `Voting window: ${input.opensAt} to ${input.closesAt}`
  ];

  if (input.temporaryPassword) {
    lines.push(
      "",
      "Temporary poll access",
      `Login: ${input.loginNick ?? input.voterNick}`,
      `Temporary password: ${input.temporaryPassword}`
    );
  }

  lines.push(
    "",
    `Open voting portal: ${input.inviteUrl}`,
    "",
    input.temporaryPassword
      ? "Use the temporary login above to enter this poll."
      : "You will still sign in with your account before accessing the poll."
  );

  return lines.join("\n");
}

function buildVoteReceiptHtml(input: VoteReceiptEmailInput) {
  return `
    <div style="font-family: Arial, sans-serif; background: #09121d; color: #f3efe7; padding: 24px;">
      <h1 style="font-size: 28px; line-height: 1.1; margin: 0 0 16px;">Vote receipt confirmed</h1>
      <p style="font-size: 16px; line-height: 1.6; color: #d6d1c7;">Hello ${input.voterNick}, your shielded vote now has one on-chain confirmation.</p>
      <div style="margin: 20px 0; padding: 16px; border-radius: 14px; background: #132334; border: 1px solid rgba(201, 180, 122, 0.18);">
        <p style="font-size: 14px; line-height: 1.6; color: #d6d1c7; margin: 0 0 6px;"><strong>Receipt ID:</strong> ${input.receiptPublicId}</p>
        <p style="font-size: 14px; line-height: 1.6; color: #d6d1c7; margin: 0 0 6px;"><strong>Poll ID:</strong> ${input.pollId}</p>
        <p style="font-size: 14px; line-height: 1.6; color: #d6d1c7; margin: 0 0 6px;"><strong>Confirmed at:</strong> ${input.confirmedAt}</p>
        <p style="font-size: 14px; line-height: 1.6; color: #d6d1c7; margin: 0;"><strong>Txid:</strong> ${input.txid}</p>
      </div>
      <p style="font-size: 16px; line-height: 1.6; color: #f3efe7;"><strong>Question:</strong> ${input.pollQuestion}</p>
      <p style="margin: 24px 0;">
        <a href="${input.portalUrl}" style="display: inline-block; background: #c9b47a; color: #09121d; padding: 12px 18px; text-decoration: none; font-weight: 700; border-radius: 10px;">Open voting portal</a>
      </p>
      <p style="font-size: 13px; line-height: 1.6; color: #8f9ba6;">This receipt confirms that your ticket completed on-chain. It does not disclose your selected option.</p>
    </div>
  `.trim();
}

function buildVoteReceiptText(input: VoteReceiptEmailInput) {
  return [
    `Hello ${input.voterNick}, your shielded vote now has one on-chain confirmation.`,
    "",
    `Question: ${input.pollQuestion}`,
    `Receipt ID: ${input.receiptPublicId}`,
    `Poll ID: ${input.pollId}`,
    `Confirmed at: ${input.confirmedAt}`,
    `Txid: ${input.txid}`,
    "",
    `Open voting portal: ${input.portalUrl}`,
    "",
    "This receipt confirms that your ticket completed on-chain. It does not disclose your selected option."
  ].join("\n");
}

export async function sendPollInviteEmail(input: PollInviteEmailInput) {
  const resend = getResendClient();
  const tags = [
    {
      name: "poll_id",
      value: input.pollId
    }
  ];

  if (input.userId) {
    tags.push({
      name: "user_id",
      value: input.userId
    });
  }

  if (input.pollVoterAccessId) {
    tags.push({
      name: "poll_voter_access_id",
      value: input.pollVoterAccessId
    });
  }

  const { data, error } = await resend.emails.send({
    from: getResendFromEmail(),
    to: input.to,
    subject: input.subject,
    html: buildInviteHtml(input),
    text: buildInviteText(input),
    tags
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.id) {
    throw new Error("Resend did not return an email id");
  }

  return {
    id: data.id
  };
}

export async function sendVoteReceiptEmail(input: VoteReceiptEmailInput) {
  const resend = getResendClient();
  const { data, error } = await resend.emails.send({
    from: getResendFromEmail(),
    to: input.to,
    subject: input.subject,
    html: buildVoteReceiptHtml(input),
    text: buildVoteReceiptText(input),
    tags: [
      {
        name: "poll_id",
        value: input.pollId
      },
      {
        name: "receipt_public_id",
        value: input.receiptPublicId
      }
    ]
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.id) {
    throw new Error("Resend did not return an email id");
  }

  return {
    id: data.id
  };
}
