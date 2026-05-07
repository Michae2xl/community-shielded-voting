import { db } from "@/lib/db";
import { generateInviteToken } from "@/lib/domain/invites";
import { formatOfficialPollDateTime } from "@/lib/domain/poll-window";
import { buildPollEmailSubject } from "@/lib/email/content";
import {
  isEmailDeliveryConfigured,
  sendPollInviteEmail
} from "@/lib/email/resend";
import { buildSignalPollInviteMessage } from "@/lib/signal/invite-message";
import {
  isSignalDeliveryConfigured,
  sendSignalMessage
} from "@/lib/signal/client";

export class InviteServiceError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 404 | 409 | 503,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "InviteServiceError";
  }
}

export async function sendPollInvites(input: {
  pollId: string;
  baseUrl: string;
  userIds?: string[];
  pollVoterAccessIds?: string[];
}) {
  const emailDeliveryConfigured = isEmailDeliveryConfigured();
  const signalDeliveryConfigured = isSignalDeliveryConfigured();

  if (!emailDeliveryConfigured && !signalDeliveryConfigured) {
    throw new InviteServiceError(
      "invite delivery is not configured",
      503,
      "DELIVERY_NOT_CONFIGURED"
    );
  }

  const poll = await db.poll.findUnique({
    where: { id: input.pollId },
    select: {
      id: true,
      question: true,
      opensAt: true,
      closesAt: true,
      eligibility: {
        select: {
          user: {
            select: {
              id: true,
              nick: true,
              email: true,
              status: true
            }
          }
        }
      },
      voterAccesses: {
        select: {
          id: true,
          nick: true,
          email: true,
          signalUsername: true,
          inviteToken: true
        }
      }
    }
  });

  if (!poll) {
    throw new InviteServiceError("poll not found", 404, "POLL_NOT_FOUND");
  }

  const eligibilityEntries = poll.eligibility ?? [];
  const voterAccesses = poll.voterAccesses ?? [];
  const requestedUserIds = input.userIds?.length ? new Set(input.userIds) : null;
  const requestedPollVoterAccessIds = input.pollVoterAccessIds?.length
    ? new Set(input.pollVoterAccessIds)
    : null;
  const selectedEligibilityEntries = requestedUserIds
    ? eligibilityEntries.filter((entry) =>
        entry.user ? requestedUserIds.has(entry.user.id) : false
      )
    : requestedPollVoterAccessIds
      ? []
      : eligibilityEntries;
  const selectedVoterAccesses = requestedPollVoterAccessIds
    ? voterAccesses.filter((access) => requestedPollVoterAccessIds.has(access.id))
    : requestedUserIds
      ? []
      : voterAccesses;
  let sent = 0;
  let sentEmail = 0;
  let sentSignal = 0;
  let failed = 0;
  let skippedMissingDelivery = 0;
  const opensAt = formatOfficialPollDateTime(poll.opensAt);
  const closesAt = formatOfficialPollDateTime(poll.closesAt);

  for (const entry of selectedEligibilityEntries) {
    const user = entry.user;

    if (!user.email || !emailDeliveryConfigured) {
      skippedMissingDelivery += 1;
      continue;
    }

    const invite = await db.pollInvite.upsert({
      where: {
        pollId_userId: {
          pollId: poll.id,
          userId: user.id
        }
      },
      update: {
        email: user.email,
        signalUsername: null,
        deliveryChannel: "EMAIL"
      },
      create: {
        pollId: poll.id,
        userId: user.id,
        email: user.email,
        signalUsername: null,
        deliveryChannel: "EMAIL",
        inviteToken: generateInviteToken()
      }
    });

    const inviteUrl = new URL(`/invites/${invite.inviteToken}`, input.baseUrl).toString();

    try {
      const delivery = await sendPollInviteEmail({
        to: user.email,
        subject: buildPollEmailSubject("Vote invitation", poll.question),
        pollQuestion: poll.question,
        voterNick: user.nick,
        loginNick: user.nick,
        inviteUrl,
        opensAt,
        closesAt,
        pollId: poll.id,
        userId: user.id
      });

      await db.pollInvite.update({
        where: { id: invite.id },
        data: {
          resendEmailId: delivery.id,
          signalMessageId: null,
          deliveryChannel: "EMAIL",
          sentAt: new Date(),
          status: invite.openedAt ? "OPENED" : "SENT",
          lastError: null
        }
      });
      sent += 1;
      sentEmail += 1;
    } catch (error) {
      await db.pollInvite.update({
        where: { id: invite.id },
        data: {
          status: "FAILED",
          lastError:
            error instanceof Error ? error.message : "Failed to send invite"
        }
      });
      failed += 1;
    }
  }

  for (const access of selectedVoterAccesses) {
    const deliveryChannel =
      access.signalUsername && signalDeliveryConfigured
        ? "SIGNAL"
        : access.email && emailDeliveryConfigured
          ? "EMAIL"
          : null;

    if (!deliveryChannel) {
      skippedMissingDelivery += 1;
      continue;
    }

    const invite = await db.pollInvite.upsert({
      where: {
        pollId_pollVoterAccessId: {
          pollId: poll.id,
          pollVoterAccessId: access.id
        }
      },
      update: {
        email: access.email,
        signalUsername: access.signalUsername,
        deliveryChannel
      },
      create: {
        pollId: poll.id,
        pollVoterAccessId: access.id,
        email: access.email,
        signalUsername: access.signalUsername,
        deliveryChannel,
        inviteToken: access.inviteToken || generateInviteToken()
      }
    });

    const inviteUrl = new URL(`/invites/${invite.inviteToken}`, input.baseUrl).toString();

    try {
      const delivery =
        deliveryChannel === "SIGNAL"
          ? await sendSignalMessage({
              to: access.signalUsername ?? "",
              message: buildSignalPollInviteMessage({
                pollQuestion: poll.question,
                voterNick: access.nick,
                inviteUrl,
                opensAt,
                closesAt,
                pollId: poll.id
              })
            })
          : await sendPollInviteEmail({
              to: access.email ?? "",
              subject: buildPollEmailSubject("Vote invitation", poll.question),
              pollQuestion: poll.question,
              voterNick: access.nick,
              loginNick: access.nick,
              inviteUrl,
              opensAt,
              closesAt,
              pollId: poll.id,
              pollVoterAccessId: access.id
            });

      await db.pollInvite.update({
        where: { id: invite.id },
        data: {
          resendEmailId: deliveryChannel === "EMAIL" ? delivery.id : null,
          signalMessageId: deliveryChannel === "SIGNAL" ? delivery.id : null,
          deliveryChannel,
          sentAt: new Date(),
          status: invite.openedAt ? "OPENED" : "SENT",
          lastError: null
        }
      });
      sent += 1;
      if (deliveryChannel === "SIGNAL") {
        sentSignal += 1;
      } else {
        sentEmail += 1;
      }
    } catch (error) {
      await db.pollInvite.update({
        where: { id: invite.id },
        data: {
          status: "FAILED",
          lastError:
            error instanceof Error ? error.message : "Failed to send invite"
        }
      });
      failed += 1;
    }
  }

  return {
    totalEligible: selectedEligibilityEntries.length + selectedVoterAccesses.length,
    sent,
    sentEmail,
    sentSignal,
    failed,
    skippedMissingDelivery,
    skippedMissingEmail: skippedMissingDelivery
  };
}

type InviteSubject =
  | {
      pollId: string;
      userId: string;
      pollVoterAccessId?: never;
    }
  | {
      pollId: string;
      userId?: never;
      pollVoterAccessId: string;
    };

export async function markPollInviteOpened(input: InviteSubject) {
  await db.pollInvite.updateMany({
    where:
      "userId" in input
        ? {
            pollId: input.pollId,
            userId: input.userId
          }
        : {
            pollId: input.pollId,
            pollVoterAccessId: input.pollVoterAccessId
          },
    data: {
      status: "OPENED",
      openedAt: new Date(),
      lastError: null
    }
  });
}
