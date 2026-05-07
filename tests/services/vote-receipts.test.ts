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

const { sendSignalMessageMock, isSignalDeliveryConfiguredMock } = vi.hoisted(() => ({
  sendSignalMessageMock: vi.fn(),
  isSignalDeliveryConfiguredMock: vi.fn()
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

vi.mock("@/lib/signal/client", () => ({
  sendSignalMessage: sendSignalMessageMock,
  isSignalDeliveryConfigured: isSignalDeliveryConfiguredMock
}));

import {
  deliverConfirmedVoteReceiptEmailsForPoll,
  deliverConfirmedVoteReceiptSignalsForPoll,
  deliverConfirmedVoteReceiptsForPoll
} from "@/lib/services/vote-receipts";

describe("deliverConfirmedVoteReceiptEmailsForPoll", () => {
  beforeEach(() => {
    process.env.APP_BASE_URL = "https://voting.zkglobalcredit.tech";
    findManyVoteReceiptsMock.mockReset();
    findUniqueVoteTicketMock.mockReset();
    updateVoteReceiptMock.mockReset();
    sendVoteReceiptEmailMock.mockReset();
    isEmailDeliveryConfiguredMock.mockReset();
    sendSignalMessageMock.mockReset();
    isSignalDeliveryConfiguredMock.mockReset();
    isEmailDeliveryConfiguredMock.mockReturnValue(true);
    isSignalDeliveryConfiguredMock.mockReturnValue(true);
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
          nick: "michae2xl",
          email: "michaelguima@proton.me"
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
      to: "michaelguima@proton.me",
      subject: "Vote receipt · Which path should we approve?",
      voterNick: "michae2xl",
      pollQuestion: "Which path should we approve?",
      pollId: "poll_1",
      receiptPublicId: "receipt_public_1",
      txid: "txid_1",
      confirmedAt: "2026-04-21T03:00:00.000Z",
      portalUrl: "https://voting.zkglobalcredit.tech/polls/poll_1"
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
          nick: "michae2xl",
          email: "michaelguima@proton.me"
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

  it("sends confirmed receipts to Signal voters without exposing the answer", async () => {
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
          nick: "michae2xl",
          signalUsername: "michae2xl.42"
        }
      }
    });
    sendSignalMessageMock.mockResolvedValue({
      id: "signal_1"
    });

    const result = await deliverConfirmedVoteReceiptSignalsForPoll("poll_1");

    expect(result).toEqual({
      sent: 1,
      skipped: 0,
      failed: 0
    });
    expect(sendSignalMessageMock).toHaveBeenCalledWith({
      to: "michae2xl.42",
      message: expect.stringContaining("Vote confirmed")
    });
    expect(sendSignalMessageMock.mock.calls[0][0].message).not.toMatch(
      /Option|choice|answer/i
    );
    expect(updateVoteReceiptMock).toHaveBeenCalledWith({
      where: {
        id: "receipt_row_1"
      },
      data: expect.objectContaining({
        receiptSignalMessageId: "signal_1",
        receiptSignalSentAt: expect.any(Date),
        receiptSignalError: null
      })
    });
  });

  it("records Signal receipt delivery failures without aborting", async () => {
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
          nick: "michae2xl",
          signalUsername: "michae2xl.42"
        }
      }
    });
    sendSignalMessageMock.mockRejectedValue(new Error("signal failed"));

    const result = await deliverConfirmedVoteReceiptSignalsForPoll("poll_1");

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
        receiptSignalError: "signal failed"
      }
    });
  });

  it("delivers both email and Signal receipt channels", async () => {
    findManyVoteReceiptsMock.mockResolvedValue([]);

    const result = await deliverConfirmedVoteReceiptsForPoll("poll_1");

    expect(result).toEqual({
      email: {
        sent: 0,
        skipped: 0,
        failed: 0
      },
      signal: {
        sent: 0,
        skipped: 0,
        failed: 0
      }
    });
    expect(findManyVoteReceiptsMock).toHaveBeenCalledTimes(2);
  });
});
