import { randomUUID } from "node:crypto";
import {
  TicketStatus,
  VoteReceiptStatus,
  type VoteOptionLetter
} from "@prisma/client";
import { db } from "@/lib/db";
import {
  recordConfirmedVoteAuditEvent,
  syncObservedVoteAuditEvents
} from "@/lib/services/public-audit-events";
import { reconcileReceipt } from "@/lib/services/reconcile";
import { deliverConfirmedVoteReceiptEmailsForPoll } from "@/lib/services/vote-receipts";
import { getZkoolClient } from "@/lib/zcash/zkool-client";

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

function tallyUpdate(optionLetter: VoteOptionLetter) {
  switch (optionLetter) {
    case "A":
      return { countA: { increment: 1 } };
    case "B":
      return { countB: { increment: 1 } };
    case "C":
      return { countC: { increment: 1 } };
    case "D":
      return { countD: { increment: 1 } };
    case "E":
      return { countE: { increment: 1 } };
  }
}

function tallyCreate(pollId: string, optionLetter: VoteOptionLetter) {
  return {
    pollId,
    totalConfirmed: 1,
    countA: optionLetter === "A" ? 1 : 0,
    countB: optionLetter === "B" ? 1 : 0,
    countC: optionLetter === "C" ? 1 : 0,
    countD: optionLetter === "D" ? 1 : 0,
    countE: optionLetter === "E" ? 1 : 0
  };
}

export async function reconcilePollVotes(pollId: string) {
  const poll = await db.poll.findUnique({
    where: { id: pollId },
    select: {
      id: true,
      status: true,
      feeZat: true
    }
  });

  if (!poll) {
    return {
      error: "POLL_NOT_FOUND" as const,
      processed: 0
    };
  }

  const incomingVotes = await getZkoolClient().fetchIncomingVotes();
  let processed = 0;

  for (const note of incomingVotes) {
    const voteRequest = await db.voteRequest.findFirst({
      where: {
        shieldedAddress: note.shieldedAddress,
        status: {
          in: ["ACTIVE", "USED"]
        }
      },
      select: {
        optionLetter: true,
        ticket: {
          select: {
            id: true,
            pollId: true,
            ticketHash: true
          }
        }
      }
    });

    if (!voteRequest || voteRequest.ticket.pollId !== pollId) {
      continue;
    }

    const ticket = voteRequest.ticket;
    const baseDecision = reconcileReceipt({
      pollStatus: poll.status,
      expectedOption: voteRequest.optionLetter,
      amountZat: note.amountZat,
      minimumAmountZat: poll.feeZat,
      memo: note.memo,
      alreadyConfirmed: false
    });

    try {
      let confirmedAuditEvent:
        | {
            pollId: string;
            txid: string;
            amountZat: bigint;
            createdAt?: Date;
          }
        | null = null;

      await db.$transaction(async (tx) => {
        let receiptStatus = baseDecision.status;
        let rejectionReason = baseDecision.rejectionReason;
        let confirmedAt =
          receiptStatus === VoteReceiptStatus.CONFIRMED ? new Date() : null;

        if (receiptStatus === VoteReceiptStatus.CONFIRMED) {
          const claimed = await tx.voteTicket.updateMany({
            where: {
              id: ticket.id,
              status: {
                in: [TicketStatus.ISSUED, TicketStatus.LOCKED]
              }
            },
            data: {
              status: TicketStatus.VOTED
            }
          });

          if (claimed.count !== 1) {
            receiptStatus = VoteReceiptStatus.DUPLICATE_IGNORED;
            rejectionReason = "ticket already has a confirmed vote";
            confirmedAt = null;
          }
        }

        await tx.voteReceipt.create({
          data: {
            pollId,
            ticketHash: ticket.ticketHash,
            receiptPublicId:
              receiptStatus === VoteReceiptStatus.CONFIRMED
                ? `receipt_${randomUUID()}`
                : null,
            optionLetter: voteRequest.optionLetter,
            txid: note.txid,
            blockHeight: note.blockHeight,
            amountZat: note.amountZat,
            memo: note.memo,
            status: receiptStatus,
            rejectionReason,
            confirmedAt
          }
        });

        if (receiptStatus === VoteReceiptStatus.CONFIRMED) {
          confirmedAuditEvent = {
            pollId,
            txid: note.txid,
            amountZat: note.amountZat,
            createdAt: confirmedAt ?? undefined
          };

          await tx.voteRequest.updateMany({
            where: {
              ticketId: ticket.id,
              status: "ACTIVE"
            },
            data: {
              status: "EXPIRED"
            }
          });

          await tx.voteRequest.updateMany({
            where: {
              ticketId: ticket.id,
              optionLetter: voteRequest.optionLetter
            },
            data: {
              status: "USED"
            }
          });

          await tx.pollTally.upsert({
            where: { pollId },
            update: {
              totalConfirmed: { increment: 1 },
              ...tallyUpdate(voteRequest.optionLetter)
            },
            create: tallyCreate(pollId, voteRequest.optionLetter)
          });
        }
      });

      if (confirmedAuditEvent) {
        try {
          await recordConfirmedVoteAuditEvent(confirmedAuditEvent);
        } catch (error) {
          console.error("Failed to record public audit vote-confirmed event", {
            pollId,
            txid: note.txid,
            error
          });
        }
      }

      processed += 1;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        continue;
      }

      throw error;
    }
  }

  try {
    await deliverConfirmedVoteReceiptEmailsForPoll(pollId);
  } catch (error) {
    console.error("Failed to deliver confirmed vote receipt emails", {
      pollId,
      error
    });
  }

  return {
    processed
  };
}

export async function runCollectorCycle() {
  const { syncAllPollLifecycles } = await import("@/lib/services/poll-lifecycle");

  const lifecycle = await syncAllPollLifecycles();
  await getZkoolClient().syncWallet();

  try {
    await syncObservedVoteAuditEvents();
  } catch (error) {
    console.error("Failed to sync observed public audit events", { error });
  }

  const openPolls = await db.poll.findMany({
    where: {
      status: "OPEN"
    },
    select: {
      id: true
    }
  });

  const reconciled = [];

  for (const poll of openPolls) {
    const result = await reconcilePollVotes(poll.id);
    reconciled.push({
      pollId: poll.id,
      ...result
    });
  }

  return {
    lifecycle,
    reconciled
  };
}
