import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findUniquePollMock,
  upsertInviteMock,
  updateInviteMock,
  sendPollInviteEmailMock,
  sendSignalMessageMock
} = vi.hoisted(() => ({
  findUniquePollMock: vi.fn(),
  upsertInviteMock: vi.fn(),
  updateInviteMock: vi.fn(),
  sendPollInviteEmailMock: vi.fn(),
  sendSignalMessageMock: vi.fn()
}));

vi.mock("@/lib/db", () => ({
  db: {
    poll: {
      findUnique: findUniquePollMock
    },
    pollInvite: {
      upsert: upsertInviteMock,
      update: updateInviteMock
    }
  }
}));

vi.mock("@/lib/email/resend", () => ({
  isEmailDeliveryConfigured: vi.fn(),
  sendPollInviteEmail: sendPollInviteEmailMock
}));

vi.mock("@/lib/signal/client", () => ({
  isSignalDeliveryConfigured: vi.fn(),
  sendSignalMessage: sendSignalMessageMock
}));

import {
  InviteServiceError,
  sendPollInvites
} from "@/lib/services/poll-invites";
import { isEmailDeliveryConfigured } from "@/lib/email/resend";
import { isSignalDeliveryConfigured } from "@/lib/signal/client";

beforeEach(() => {
  findUniquePollMock.mockReset();
  upsertInviteMock.mockReset();
  updateInviteMock.mockReset();
  sendPollInviteEmailMock.mockReset();
  sendSignalMessageMock.mockReset();
  vi.mocked(isEmailDeliveryConfigured).mockReset();
  vi.mocked(isSignalDeliveryConfigured).mockReset();
  vi.mocked(isSignalDeliveryConfigured).mockReturnValue(false);
});

describe("sendPollInvites", () => {
  it("throws when no invite delivery channel is configured", async () => {
    vi.mocked(isEmailDeliveryConfigured).mockReturnValue(false);
    vi.mocked(isSignalDeliveryConfigured).mockReturnValue(false);

    await expect(
      sendPollInvites({
        pollId: "poll_1",
        baseUrl: "https://vote.example.com"
      })
    ).rejects.toMatchObject({
      code: "DELIVERY_NOT_CONFIGURED",
      status: 503
    } satisfies Partial<InviteServiceError>);
  });

  it("sends invites to eligible users with email and skips users without email", async () => {
    vi.mocked(isEmailDeliveryConfigured).mockReturnValue(true);
    findUniquePollMock.mockResolvedValue({
      id: "poll_1",
      question: "Which governance path should be activated next?",
      opensAt: new Date("2026-05-01T10:00:00.000Z"),
      closesAt: new Date("2026-05-03T10:00:00.000Z"),
      eligibility: [
        {
          user: {
            id: "user_1",
            nick: "alice",
            email: "alice@example.com",
            status: "ACTIVE"
          }
        },
        {
          user: {
            id: "user_2",
            nick: "bob",
            email: null,
            status: "ACTIVE"
          }
        }
      ],
      voterAccesses: []
    });
    upsertInviteMock.mockResolvedValue({
      id: "invite_1",
      pollId: "poll_1",
      userId: "user_1",
      email: "alice@example.com",
      inviteToken: "token_1",
      openedAt: null,
      status: "PENDING"
    });
    sendPollInviteEmailMock.mockResolvedValue({
      id: "email_1"
    });

    const result = await sendPollInvites({
      pollId: "poll_1",
      baseUrl: "https://vote.example.com"
    });

    expect(result).toMatchObject({
      totalEligible: 2,
      sent: 1,
      failed: 0,
      skippedMissingDelivery: 1,
      skippedMissingEmail: 1
    });
    expect(upsertInviteMock).toHaveBeenCalledWith({
      where: {
        pollId_userId: {
          pollId: "poll_1",
          userId: "user_1"
        }
      },
      update: expect.objectContaining({
        email: "alice@example.com",
        deliveryChannel: "EMAIL"
      }),
      create: expect.objectContaining({
        pollId: "poll_1",
        userId: "user_1",
        email: "alice@example.com",
        deliveryChannel: "EMAIL"
      })
    });
    expect(sendPollInviteEmailMock).toHaveBeenCalledWith({
      to: "alice@example.com",
      subject: expect.stringMatching(/which governance path/i),
      pollQuestion: "Which governance path should be activated next?",
      voterNick: "alice",
      loginNick: "alice",
      inviteUrl: "https://vote.example.com/invites/token_1",
      opensAt: "01 May 2026, 10:00 UTC",
      closesAt: "03 May 2026, 10:00 UTC",
      pollId: "poll_1",
      userId: "user_1"
    });
    expect(updateInviteMock).toHaveBeenCalledWith({
      where: { id: "invite_1" },
      data: expect.objectContaining({
        resendEmailId: "email_1",
        signalMessageId: null,
        deliveryChannel: "EMAIL",
        status: "SENT",
        lastError: null
      })
    });
  });

  it("marks failed deliveries without aborting the whole batch", async () => {
    vi.mocked(isEmailDeliveryConfigured).mockReturnValue(true);
    findUniquePollMock.mockResolvedValue({
      id: "poll_1",
      question: "Which governance path should be activated next?",
      opensAt: new Date("2026-05-01T10:00:00.000Z"),
      closesAt: new Date("2026-05-03T10:00:00.000Z"),
      eligibility: [
        {
          user: {
            id: "user_1",
            nick: "alice",
            email: "alice@example.com",
            status: "ACTIVE"
          }
        }
      ],
      voterAccesses: []
    });
    upsertInviteMock.mockResolvedValue({
      id: "invite_1",
      pollId: "poll_1",
      userId: "user_1",
      email: "alice@example.com",
      inviteToken: "token_1",
      openedAt: null,
      status: "PENDING"
    });
    sendPollInviteEmailMock.mockRejectedValue(new Error("resend failed"));

    const result = await sendPollInvites({
      pollId: "poll_1",
      baseUrl: "https://vote.example.com"
    });

    expect(result).toMatchObject({
      totalEligible: 1,
      sent: 0,
      failed: 1,
      skippedMissingDelivery: 0,
      skippedMissingEmail: 0
    });
    expect(updateInviteMock).toHaveBeenCalledWith({
      where: { id: "invite_1" },
      data: expect.objectContaining({
        status: "FAILED",
        lastError: "resend failed"
      })
    });
  });

  it("sends Signal invite links without temporary passwords for poll voter access", async () => {
    vi.mocked(isEmailDeliveryConfigured).mockReturnValue(false);
    vi.mocked(isSignalDeliveryConfigured).mockReturnValue(true);
    findUniquePollMock.mockResolvedValue({
      id: "poll_1",
      question: "Which governance path should be activated next?",
      opensAt: new Date("2026-05-01T10:00:00.000Z"),
      closesAt: new Date("2026-05-03T10:00:00.000Z"),
      eligibility: [],
      voterAccesses: [
        {
          id: "access_1",
          nick: "michae2xl",
          email: null,
          signalUsername: "michae2xl.42",
          inviteToken: "token_1"
        }
      ]
    });
    upsertInviteMock.mockResolvedValue({
      id: "invite_1",
      pollId: "poll_1",
      pollVoterAccessId: "access_1",
      email: null,
      signalUsername: "michae2xl.42",
      inviteToken: "token_1",
      openedAt: null,
      status: "PENDING"
    });
    sendSignalMessageMock.mockResolvedValue({
      id: "signal_1"
    });

    const result = await sendPollInvites({
      pollId: "poll_1",
      baseUrl: "https://vote.example.com"
    });

    expect(result).toMatchObject({
      totalEligible: 1,
      sent: 1,
      sentSignal: 1,
      failed: 0,
      skippedMissingDelivery: 0,
      skippedMissingEmail: 0
    });
    expect(upsertInviteMock).toHaveBeenCalledWith({
      where: {
        pollId_pollVoterAccessId: {
          pollId: "poll_1",
          pollVoterAccessId: "access_1"
        }
      },
      update: expect.objectContaining({
        email: null,
        signalUsername: "michae2xl.42",
        deliveryChannel: "SIGNAL"
      }),
      create: expect.objectContaining({
        pollId: "poll_1",
        pollVoterAccessId: "access_1",
        email: null,
        signalUsername: "michae2xl.42",
        deliveryChannel: "SIGNAL",
        inviteToken: "token_1"
      })
    });
    expect(sendPollInviteEmailMock).not.toHaveBeenCalled();
    expect(sendSignalMessageMock).toHaveBeenCalledWith({
      to: "michae2xl.42",
      message: expect.stringContaining("https://vote.example.com/invites/token_1")
    });
    expect(sendSignalMessageMock.mock.calls[0][0].message).toContain(
      "Which governance path should be activated next?"
    );
    expect(sendSignalMessageMock.mock.calls[0][0].message).not.toContain("TEMP-PASS");
    expect(updateInviteMock).toHaveBeenCalledWith({
      where: { id: "invite_1" },
      data: expect.objectContaining({
        resendEmailId: null,
        signalMessageId: "signal_1",
        deliveryChannel: "SIGNAL",
        status: "SENT",
        lastError: null
      })
    });
  });
});
