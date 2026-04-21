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

type EmailShellInput = {
  originHint?: string;
  eyebrow: string;
  title: string;
  intro: string;
  detailHtml?: string;
  infoHtml: string;
  actionLabel: string;
  actionHref: string;
  footerNote: string;
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getOrigin(inputUrl?: string) {
  const candidate = process.env.APP_BASE_URL || inputUrl;

  if (!candidate) {
    return "";
  }

  try {
    return new URL(candidate).origin;
  } catch {
    return "";
  }
}

function isPublicAssetOrigin(origin: string) {
  if (!origin) {
    return false;
  }

  try {
    const { hostname } = new URL(origin);
    return !(
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1"
    );
  } catch {
    return false;
  }
}

function buildAssetUrl(origin: string, path: string) {
  if (!origin) {
    return "";
  }

  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

function buildEmailShell(input: EmailShellInput) {
  const origin = getOrigin(input.originHint);
  const useSvgAssets = isPublicAssetOrigin(origin);
  const zcashLogo = useSvgAssets
    ? `<img src="${buildAssetUrl(origin, "/brand/zcash-secondary-yellow.svg")}" alt="Zcash" width="18" height="18" style="display:block;width:18px;height:18px;" />`
    : `
    <span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:999px;background:#f4b728;color:#ffffff;font-size:12px;line-height:1;font-weight:700;font-family:Arial,sans-serif;">
      Z
    </span>
  `.trim();
  const systemMark = useSvgAssets
    ? `<img src="${buildAssetUrl(origin, "/art/email-shielded-voting-mark.svg")}" alt="" width="58" height="58" style="display:block;width:58px;height:58px;" />`
    : `
    <div style="width:58px;height:58px;border-radius:18px;background:linear-gradient(180deg, #fff7e8 0%, #f4e4c3 100%);border:1px solid rgba(127,92,46,0.16);display:flex;align-items:center;justify-content:center;">
      <span style="display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:999px;background:#c59a49;color:#ffffff;font-size:13px;line-height:1;font-weight:700;letter-spacing:0.08em;font-family:Arial,sans-serif;">
        SV
      </span>
    </div>
  `.trim();

  return `
    <div style="margin:0;padding:32px 16px;background:#f7f0e4;">
      <div style="max-width:640px;margin:0 auto;border-radius:28px;overflow:hidden;border:1px solid rgba(127,92,46,0.14);background:#fffaf2;box-shadow:0 22px 50px rgba(82,55,28,0.10);">
        <div style="padding:22px 26px 0;background:linear-gradient(180deg, rgba(245,235,216,0.96) 0%, rgba(255,250,242,0.94) 100%);">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
            <tr>
              <td align="left" style="vertical-align:top;">
                <p style="margin:0 0 8px;color:#8a693a;font-size:11px;line-height:1.4;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;font-family:Arial,sans-serif;">Shielded voting</p>
                <p style="margin:0;color:#3c2a1a;font-size:22px;line-height:1.1;font-weight:700;font-family:Georgia,'Times New Roman',serif;">${escapeHtml(input.eyebrow)}</p>
              </td>
              <td align="right" style="vertical-align:top;">
                <div style="display:inline-block;padding:9px 12px;border-radius:999px;background:#f4e3b5;color:#67471f;font-size:11px;line-height:1;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;font-family:Arial,sans-serif;white-space:nowrap;">
                  <span style="display:inline-block;vertical-align:middle;margin-right:8px;">${zcashLogo}</span>
                  <span style="display:inline-block;vertical-align:middle;">Built on Zcash</span>
                </div>
              </td>
            </tr>
          </table>
          <div style="margin-top:22px;padding:28px;border-radius:24px;background:linear-gradient(180deg, rgba(255,252,247,0.98) 0%, rgba(249,241,229,0.94) 100%);border:1px solid rgba(127,92,46,0.12);">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
              <tr>
                <td width="76" valign="top" style="padding:0 18px 0 0;">
                  ${systemMark}
                </td>
                <td valign="top">
                  <h1 style="margin:0 0 14px;color:#2f1f12;font-size:34px;line-height:1.02;font-weight:700;letter-spacing:-0.04em;font-family:Arial,sans-serif;">${escapeHtml(input.title)}</h1>
                  <p style="margin:0;color:#6b5843;font-size:16px;line-height:1.75;font-family:Arial,sans-serif;">${escapeHtml(input.intro)}</p>
                </td>
              </tr>
            </table>
          </div>
        </div>
        <div style="padding:24px 26px 28px;background:#fffaf2;">
          ${input.detailHtml ?? ""}
          <div style="padding:18px 18px 20px;border-radius:22px;border:1px solid rgba(127,92,46,0.12);background:#fffcf7;">
            ${input.infoHtml}
          </div>
          <div style="margin-top:22px;">
            <a href="${input.actionHref}" style="display:inline-block;padding:14px 22px;border-radius:14px;background:#c59a49;color:#20160f;text-decoration:none;font-size:13px;line-height:1;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;font-family:Arial,sans-serif;">${escapeHtml(input.actionLabel)}</a>
          </div>
          <div style="margin-top:20px;padding-top:18px;border-top:1px solid rgba(127,92,46,0.12);">
            <p style="margin:0;color:#7d6a54;font-size:13px;line-height:1.75;font-family:Arial,sans-serif;">${escapeHtml(input.footerNote)}</p>
          </div>
        </div>
      </div>
    </div>
  `.trim();
}

function buildInviteHtml(input: PollInviteEmailInput) {
  const credentialBlock = input.temporaryPassword
    ? `
      <div style="margin: 0 0 20px; padding: 18px; border-radius: 20px; background: linear-gradient(180deg, #fff8ec 0%, #f9edd6 100%); border: 1px solid rgba(127, 92, 46, 0.16);">
        <p style="font-size: 11px; line-height: 1.5; color: #8a693a; text-transform: uppercase; letter-spacing: 0.16em; margin: 0 0 10px; font-weight: 700; font-family: Arial, sans-serif;">Temporary poll access</p>
        <p style="font-size: 14px; line-height: 1.7; color: #4e3927; margin: 0 0 6px; font-family: Arial, sans-serif;"><strong>Login:</strong> ${escapeHtml(input.loginNick ?? input.voterNick)}</p>
        <p style="font-size: 14px; line-height: 1.7; color: #4e3927; margin: 0; font-family: Arial, sans-serif;"><strong>Temporary password:</strong> ${escapeHtml(input.temporaryPassword)}</p>
      </div>
    `
    : "";
  const accessCopy = input.temporaryPassword
    ? "Use the temporary login above to enter this poll. These credentials are scoped to this invitation."
    : "You will still sign in with your account before accessing the poll. This link is unique to this poll invitation.";

  return buildEmailShell({
    originHint: input.inviteUrl,
    eyebrow: "Invite",
    title: "You are invited to vote",
    intro: `Hello ${input.voterNick}, your shielded poll access is ready.`,
    detailHtml: credentialBlock,
    infoHtml: `
      <p style="margin:0 0 12px;color:#38281b;font-size:16px;line-height:1.7;font-family:Arial,sans-serif;"><strong>Question:</strong> ${escapeHtml(input.pollQuestion)}</p>
      <p style="margin:0;color:#6b5843;font-size:14px;line-height:1.7;font-family:Arial,sans-serif;"><strong>Voting window:</strong> ${escapeHtml(input.opensAt)} to ${escapeHtml(input.closesAt)}</p>
    `,
    actionLabel: "Open voting portal",
    actionHref: input.inviteUrl,
    footerNote: accessCopy
  });
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
  return buildEmailShell({
    originHint: input.portalUrl,
    eyebrow: "Receipt",
    title: "Vote receipt confirmed",
    intro: `Hello ${input.voterNick}, your shielded vote now has one on-chain confirmation.`,
    infoHtml: `
      <p style="margin:0 0 12px;color:#38281b;font-size:16px;line-height:1.7;font-family:Arial,sans-serif;"><strong>Question:</strong> ${escapeHtml(input.pollQuestion)}</p>
      <div>
        <p style="margin:0;color:#6b5843;font-size:14px;line-height:1.7;font-family:Arial,sans-serif;"><strong>Receipt ID:</strong> ${escapeHtml(input.receiptPublicId)}</p>
        <p style="margin:0;color:#6b5843;font-size:14px;line-height:1.7;font-family:Arial,sans-serif;"><strong>Poll ID:</strong> ${escapeHtml(input.pollId)}</p>
        <p style="margin:0;color:#6b5843;font-size:14px;line-height:1.7;font-family:Arial,sans-serif;"><strong>Confirmed at:</strong> ${escapeHtml(input.confirmedAt)}</p>
        <p style="margin:0;color:#6b5843;font-size:14px;line-height:1.7;font-family:Arial,sans-serif;word-break:break-word;"><strong>Txid:</strong> ${escapeHtml(input.txid)}</p>
      </div>
    `,
    actionLabel: "Open voting portal",
    actionHref: input.portalUrl,
    footerNote:
      "This receipt confirms that your ticket completed on-chain. It does not disclose your selected option."
  });
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
