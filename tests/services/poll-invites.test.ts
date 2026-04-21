import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findUniquePollMock,
  upsertInviteMock,
  updateInviteMock,
  sendPollInviteEmailMock,
  issueTemporaryPollPasswordMock
} = vi.hoisted(() => ({
  findUniquePollMock: vi.fn(),
  upsertInviteMock: vi.fn(),
  updateInviteMock: vi.fn(),
  sendPollInviteEmailMock: vi.fn(),
  issueTemporaryPollPasswordMock: vi.fn()
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

vi.mock("@/lib/services/poll-voter-access", () => ({
  issueTemporaryPollPassword: issueTemporaryPollPasswordMock
}));

import {
  InviteServiceError,
  sendPollInvites
} from "@/lib/services/poll-invites";
import { isEmailDeliveryConfigured } from "@/lib/email/resend";

beforeEach(() => {
  findUniquePollMock.mockReset();
  upsertInviteMock.mockReset();
  updateInviteMock.mockReset();
  sendPollInviteEmailMock.mockReset();
  issueTemporaryPollPasswordMock.mockReset();
  vi.mocked(isEmailDeliveryConfigured).mockReset();
});

describe("sendPollInvites", () => {
  it("throws when email delivery is not configured", async () => {
    vi.mocked(isEmailDeliveryConfigured).mockReturnValue(false);

    await expect(
      sendPollInvites({
        pollId: "poll_1",
        baseUrl: "https://vote.example.com"
      })
    ).rejects.toMatchObject({
      code: "EMAIL_NOT_CONFIGURED",
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
      skippedMissingEmail: 1
    });
    expect(upsertInviteMock).toHaveBeenCalledWith({
      where: {
        pollId_userId: {
          pollId: "poll_1",
          userId: "user_1"
        }
      },
      update: {
        email: "alice@example.com"
      },
      create: expect.objectContaining({
        pollId: "poll_1",
        userId: "user_1",
        email: "alice@example.com"
      })
    });
    expect(sendPollInviteEmailMock).toHaveBeenCalledWith({
      to: "alice@example.com",
      subject: expect.stringMatching(/which governance path/i),
      pollQuestion: "Which governance path should be activated next?",
      voterNick: "alice",
      loginNick: "alice",
      inviteUrl: "https://vote.example.com/invites/token_1",
      opensAt: "2026-05-01T10:00:00.000Z",
      closesAt: "2026-05-03T10:00:00.000Z",
      pollId: "poll_1",
      userId: "user_1"
    });
    expect(updateInviteMock).toHaveBeenCalledWith({
      where: { id: "invite_1" },
      data: expect.objectContaining({
        resendEmailId: "email_1",
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

  it("sends invite emails with temporary credentials for poll voter access", async () => {
    vi.mocked(isEmailDeliveryConfigured).mockReturnValue(true);
    findUniquePollMock.mockResolvedValue({
      id: "poll_1",
      question: "Which governance path should be activated next?",
      opensAt: new Date("2026-05-01T10:00:00.000Z"),
      closesAt: new Date("2026-05-03T10:00:00.000Z"),
      eligibility: [],
      voterAccesses: [
        {
          id: "access_1",
          nick: "voter01",
          email: "voter01@example.com",
          inviteToken: "token_1"
        }
      ]
    });
    upsertInviteMock.mockResolvedValue({
      id: "invite_1",
      pollId: "poll_1",
      pollVoterAccessId: "access_1",
      email: "voter01@example.com",
      inviteToken: "token_1",
      openedAt: null,
      status: "PENDING"
    });
    issueTemporaryPollPasswordMock.mockResolvedValue({
      plaintextPassword: "TEMP-PASS-01"
    });
    sendPollInviteEmailMock.mockResolvedValue({
      id: "email_1"
    });

    const result = await sendPollInvites({
      pollId: "poll_1",
      baseUrl: "https://vote.example.com"
    });

    expect(result).toMatchObject({
      totalEligible: 1,
      sent: 1,
      failed: 0,
      skippedMissingEmail: 0
    });
    expect(issueTemporaryPollPasswordMock).toHaveBeenCalledWith({
      pollVoterAccessId: "access_1"
    });
    expect(upsertInviteMock).toHaveBeenCalledWith({
      where: {
        pollId_pollVoterAccessId: {
          pollId: "poll_1",
          pollVoterAccessId: "access_1"
        }
      },
      update: {
        email: "voter01@example.com"
      },
      create: expect.objectContaining({
        pollId: "poll_1",
        pollVoterAccessId: "access_1",
        email: "voter01@example.com",
        inviteToken: "token_1"
      })
    });
    expect(sendPollInviteEmailMock).toHaveBeenCalledWith({
      to: "voter01@example.com",
      subject: expect.stringMatching(/which governance path/i),
      pollQuestion: "Which governance path should be activated next?",
      voterNick: "voter01",
      loginNick: "voter01",
      temporaryPassword: "TEMP-PASS-01",
      inviteUrl: "https://vote.example.com/invites/token_1",
      opensAt: "2026-05-01T10:00:00.000Z",
      closesAt: "2026-05-03T10:00:00.000Z",
      pollId: "poll_1",
      pollVoterAccessId: "access_1"
    });
    expect(updateInviteMock).toHaveBeenCalledWith({
      where: { id: "invite_1" },
      data: expect.objectContaining({
        resendEmailId: "email_1",
        status: "SENT",
        lastError: null
      })
    });
  });
});
