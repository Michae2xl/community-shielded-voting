import { beforeEach, describe, expect, it, vi } from "vitest";
import { verifyPassword } from "@/lib/auth/password";

const {
  pollVoterAccessFindUniqueMock,
  pollVoterAccessUpdateMock
} = vi.hoisted(() => ({
  pollVoterAccessFindUniqueMock: vi.fn(),
  pollVoterAccessUpdateMock: vi.fn()
}));

vi.mock("@/lib/db", () => ({
  db: {
    pollVoterAccess: {
      findUnique: pollVoterAccessFindUniqueMock,
      update: pollVoterAccessUpdateMock
    }
  }
}));

import {
  authenticateTemporaryPollVoter,
  issueTemporaryPollPassword
} from "@/lib/services/poll-voter-access";

describe("poll voter access service", () => {
  beforeEach(() => {
    pollVoterAccessFindUniqueMock.mockReset();
    pollVoterAccessUpdateMock.mockReset();
  });

  it("issues a plaintext password and stores only the hash", async () => {
    pollVoterAccessUpdateMock.mockResolvedValue({ id: "access_1" });

    const result = await issueTemporaryPollPassword({
      pollVoterAccessId: "access_1"
    });

    expect(result.plaintextPassword).toMatch(/^[A-Z0-9-]{10,}$/);
    expect(pollVoterAccessUpdateMock).toHaveBeenCalledTimes(1);

    const updateArgs = pollVoterAccessUpdateMock.mock.calls[0][0];

    expect(updateArgs).toEqual(
      expect.objectContaining({
        where: { id: "access_1" },
        data: expect.objectContaining({
          passwordHash: expect.any(String),
          passwordIssuedAt: expect.any(Date),
          status: "ACTIVE"
        })
      })
    );
    expect(updateArgs.data.passwordHash).not.toBe(result.plaintextPassword);
    await expect(
      verifyPassword(result.plaintextPassword, updateArgs.data.passwordHash)
    ).resolves.toBe(true);
  });

  it("authenticates only active non-expired poll voter access rows", async () => {
    const password = "TEMP-PASS-01";
    const { plaintextPassword: issuedPassword } = await issueTemporaryPollPassword({
      pollVoterAccessId: "access_issued"
    });
    const issuedUpdateArgs = pollVoterAccessUpdateMock.mock.calls[0][0];

    pollVoterAccessFindUniqueMock.mockResolvedValue({
      id: "access_1",
      pollId: "poll_1",
      nick: "voter01",
      email: "voter01@example.com",
      passwordHash: issuedUpdateArgs.data.passwordHash,
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 60_000)
    });

    await expect(
      authenticateTemporaryPollVoter({
        pollId: "poll_1",
        nick: "voter01",
        password: issuedPassword
      })
    ).resolves.toEqual(
      expect.objectContaining({
        id: "access_1",
        pollId: "poll_1",
        nick: "voter01"
      })
    );

    await expect(
      authenticateTemporaryPollVoter({
        pollId: "poll_1",
        nick: "voter01",
        password
      })
    ).resolves.toBeNull();
  });

  it("rejects expired or inactive voter access rows", async () => {
    const { plaintextPassword } = await issueTemporaryPollPassword({
      pollVoterAccessId: "access_issued"
    });
    const issuedUpdateArgs = pollVoterAccessUpdateMock.mock.calls[0][0];

    pollVoterAccessFindUniqueMock.mockResolvedValueOnce({
      id: "access_expired",
      pollId: "poll_1",
      nick: "voter01",
      email: "voter01@example.com",
      passwordHash: issuedUpdateArgs.data.passwordHash,
      status: "ACTIVE",
      expiresAt: new Date(Date.now() - 1_000)
    });

    await expect(
      authenticateTemporaryPollVoter({
        pollId: "poll_1",
        nick: "voter01",
        password: plaintextPassword
      })
    ).resolves.toBeNull();

    pollVoterAccessFindUniqueMock.mockResolvedValueOnce({
      id: "access_revoked",
      pollId: "poll_1",
      nick: "voter01",
      email: "voter01@example.com",
      passwordHash: issuedUpdateArgs.data.passwordHash,
      status: "REVOKED",
      expiresAt: new Date(Date.now() + 60_000)
    });

    await expect(
      authenticateTemporaryPollVoter({
        pollId: "poll_1",
        nick: "voter01",
        password: plaintextPassword
      })
    ).resolves.toBeNull();
  });
});
