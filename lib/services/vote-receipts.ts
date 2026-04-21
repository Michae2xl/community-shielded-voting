import {
  isEmailDeliveryConfigured,
  sendVoteReceiptEmail
} from "@/lib/email/resend";
import { db } from "@/lib/db";

function buildPortalUrl(pollId: string) {
  return new URL(
    `/polls/${pollId}`,
    process.env.APP_BASE_URL ?? "http://localhost:3000"
  ).toString();
}

export async function deliverConfirmedVoteReceiptEmailsForPoll(pollId: string) {
  if (!isEmailDeliveryConfigured()) {
    return {
      sent: 0,
      skipped: 0,
      failed: 0
    };
  }

  const receipts = await db.voteReceipt.findMany({
    where: {
      pollId,
      status: "CONFIRMED",
      receiptPublicId: {
        not: null
      },
      receiptEmailSentAt: null
    },
    select: {
      id: true,
      pollId: true,
      ticketHash: true,
      receiptPublicId: true,
      txid: true,
      confirmedAt: true,
      poll: {
        select: {
          question: true
        }
      }
    }
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const receipt of receipts) {
    const ticket = await db.voteTicket.findUnique({
      where: {
        ticketHash: receipt.ticketHash
      },
      select: {
        assignment: {
          select: {
            user: {
              select: {
                nick: true,
                email: true
              }
            },
            pollVoterAccess: {
              select: {
                nick: true,
                email: true
              }
            }
          }
        }
      }
    });

    const recipient =
      ticket?.assignment?.pollVoterAccess ?? ticket?.assignment?.user ?? null;

    if (
      !recipient?.email ||
      !receipt.receiptPublicId ||
      !receipt.confirmedAt
    ) {
      skipped += 1;
      continue;
    }

    try {
      const delivery = await sendVoteReceiptEmail({
        to: recipient.email,
        subject: `Vote receipt · ${receipt.poll.question}`,
        voterNick: recipient.nick,
        pollQuestion: receipt.poll.question,
        pollId: receipt.pollId,
        receiptPublicId: receipt.receiptPublicId,
        txid: receipt.txid,
        confirmedAt: receipt.confirmedAt.toISOString(),
        portalUrl: buildPortalUrl(receipt.pollId)
      });

      await db.voteReceipt.update({
        where: {
          id: receipt.id
        },
        data: {
          receiptEmailId: delivery.id,
          receiptEmailSentAt: new Date(),
          receiptEmailError: null
        }
      });
      sent += 1;
    } catch (error) {
      await db.voteReceipt.update({
        where: {
          id: receipt.id
        },
        data: {
          receiptEmailError:
            error instanceof Error ? error.message : "Failed to send vote receipt"
        }
      });
      failed += 1;
    }
  }

  return {
    sent,
    skipped,
    failed
  };
}
