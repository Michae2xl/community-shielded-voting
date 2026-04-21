import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findManyVoteReceiptsMock,
  findUniqueVoteTicketMock,
  updateVoteReceiptMock
} = vi.hoisted(() => ({
  findManyVoteReceiptsMock: vi.fn(),
  findUniqueVoteTicketMock: vi.fn(),
  updateVoteReceiptMock: vi.fn()
}));

const { sendVoteReceiptEmailMock, isEmailDeliveryConfiguredMock } = vi.hoisted(() => ({
  sendVoteReceiptEmailMock: vi.fn(),
  isEmailDeliveryConfiguredMock: vi.fn()
}));

vi.mock("@/lib/db", () => ({
  db: {
    voteReceipt: {
      findMany: findManyVoteReceiptsMock,
      update: updateVoteReceiptMock
    },
    voteTicket: {
      findUnique: findUniqueVoteTicketMock
    }
  }
}));

vi.mock("@/lib/email/resend", () => ({
  sendVoteReceiptEmail: sendVoteReceiptEmailMock,
  isEmailDeliveryConfigured: isEmailDeliveryConfiguredMock
}));

import { deliverConfirmedVoteReceiptEmailsForPoll } from "@/lib/services/vote-receipts";

describe("deliverConfirmedVoteReceiptEmailsForPoll", () => {
  beforeEach(() => {
    process.env.APP_BASE_URL = "https://demo.community-shielded-voting.example";
    findManyVoteReceiptsMock.mockReset();
    findUniqueVoteTicketMock.mockReset();
    updateVoteReceiptMock.mockReset();
    sendVoteReceiptEmailMock.mockReset();
    isEmailDeliveryConfiguredMock.mockReset();
    isEmailDeliveryConfiguredMock.mockReturnValue(true);
  });

  it("emails confirmed receipts to the temporary voter and marks them as sent", async () => {
    findManyVoteReceiptsMock.mockResolvedValue([
      {
        id: "receipt_row_1",
        pollId: "poll_1",
        ticketHash: "ticket_hash_1",
        receiptPublicId: "receipt_public_1",
        txid: "txid_1",
        confirmedAt: new Date("2026-04-21T03:00:00.000Z"),
        poll: {
          question: "Which path should we approve?"
        }
      }
    ]);
    findUniqueVoteTicketMock.mockResolvedValue({
      assignment: {
        pollVoterAccess: {
          nick: "voter01",
          email: "voter01@example.com"
        },
        user: null
      }
    });
    sendVoteReceiptEmailMock.mockResolvedValue({
      id: "email_1"
    });

    const result = await deliverConfirmedVoteReceiptEmailsForPoll("poll_1");

    expect(result).toEqual({
      sent: 1,
      skipped: 0,
      failed: 0
    });
    expect(sendVoteReceiptEmailMock).toHaveBeenCalledWith({
      to: "voter01@example.com",
      subject: "Vote receipt · Which path should we approve?",
      voterNick: "voter01",
      pollQuestion: "Which path should we approve?",
      pollId: "poll_1",
      receiptPublicId: "receipt_public_1",
      txid: "txid_1",
      confirmedAt: "2026-04-21T03:00:00.000Z",
      portalUrl: "https://demo.community-shielded-voting.example/polls/poll_1"
    });
    expect(updateVoteReceiptMock).toHaveBeenCalledWith({
      where: {
        id: "receipt_row_1"
      },
      data: expect.objectContaining({
        receiptEmailId: "email_1",
        receiptEmailSentAt: expect.any(Date),
        receiptEmailError: null
      })
    });
  });

  it("skips receipts that do not resolve to a voter email", async () => {
    findManyVoteReceiptsMock.mockResolvedValue([
      {
        id: "receipt_row_1",
        pollId: "poll_1",
        ticketHash: "ticket_hash_1",
        receiptPublicId: "receipt_public_1",
        txid: "txid_1",
        confirmedAt: new Date("2026-04-21T03:00:00.000Z"),
        poll: {
          question: "Which path should we approve?"
        }
      }
    ]);
    findUniqueVoteTicketMock.mockResolvedValue({
      assignment: {
        pollVoterAccess: null,
        user: {
          nick: "alice",
          email: null
        }
      }
    });

    const result = await deliverConfirmedVoteReceiptEmailsForPoll("poll_1");

    expect(result).toEqual({
      sent: 0,
      skipped: 1,
      failed: 0
    });
    expect(sendVoteReceiptEmailMock).not.toHaveBeenCalled();
    expect(updateVoteReceiptMock).not.toHaveBeenCalled();
  });

  it("records a delivery error without aborting the batch", async () => {
    findManyVoteReceiptsMock.mockResolvedValue([
      {
        id: "receipt_row_1",
        pollId: "poll_1",
        ticketHash: "ticket_hash_1",
        receiptPublicId: "receipt_public_1",
        txid: "txid_1",
        confirmedAt: new Date("2026-04-21T03:00:00.000Z"),
        poll: {
          question: "Which path should we approve?"
        }
      }
    ]);
    findUniqueVoteTicketMock.mockResolvedValue({
      assignment: {
        pollVoterAccess: {
          nick: "voter01",
          email: "voter01@example.com"
        },
        user: null
      }
    });
    sendVoteReceiptEmailMock.mockRejectedValue(new Error("resend failed"));

    const result = await deliverConfirmedVoteReceiptEmailsForPoll("poll_1");

    expect(result).toEqual({
      sent: 0,
      skipped: 0,
      failed: 1
    });
    expect(updateVoteReceiptMock).toHaveBeenCalledWith({
      where: {
        id: "receipt_row_1"
      },
      data: {
        receiptEmailError: "resend failed"
      }
    });
  });

  it("does nothing when email delivery is not configured", async () => {
    isEmailDeliveryConfiguredMock.mockReturnValue(false);

    const result = await deliverConfirmedVoteReceiptEmailsForPoll("poll_1");

    expect(result).toEqual({
      sent: 0,
      skipped: 0,
      failed: 0
    });
    expect(findManyVoteReceiptsMock).not.toHaveBeenCalled();
  });
});
