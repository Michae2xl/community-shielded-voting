import { beforeEach, describe, expect, it, vi } from "vitest";

type PollRecord = {
  id: string;
  status: "DRAFT" | "ANCHORING" | "SCHEDULED";
  questionHash: string;
  opensAt: Date;
  closesAt: Date;
  anchorTxid: string | null;
};

const { findUniqueMock, updateManyMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  updateManyMock: vi.fn()
}));

vi.mock("@/lib/db", () => ({
  db: {
    poll: {
      findUnique: findUniqueMock,
      updateMany: updateManyMock
    }
  }
}));

import {
  buildAndStoreAnchorMemo,
  markPollAnchoring,
  releasePollAnchoring
} from "@/lib/services/polls";

function installPollState() {
  const poll: PollRecord = {
    id: "poll_1",
    status: "DRAFT",
    questionHash: "hash_1",
    opensAt: new Date("2026-05-01T10:00:00.000Z"),
    closesAt: new Date("2026-05-03T10:00:00.000Z"),
    anchorTxid: null
  };

  findUniqueMock.mockImplementation(async ({ where }: { where: { id: string } }) =>
    where.id === poll.id ? { ...poll } : null
  );

  updateManyMock.mockImplementation(
    async ({
      where,
      data
    }: {
      where: { id: string; status: PollRecord["status"] };
      data: Partial<PollRecord>;
    }) => {
      if (where.id !== poll.id || where.status !== poll.status) {
        return { count: 0 };
      }

      Object.assign(poll, data);

      return { count: 1 };
    }
  );

  return poll;
}

beforeEach(() => {
  findUniqueMock.mockReset();
  updateManyMock.mockReset();
});

describe("poll anchoring", () => {
  it("moves a draft poll to anchoring before building the memo", async () => {
    const poll = installPollState();

    const memo = await buildAndStoreAnchorMemo("poll_1");

    expect(memo).toBe(
      "POLL|v1|poll_1|hash_1|2026-05-01T10:00:00.000Z|2026-05-03T10:00:00.000Z"
    );
    expect(poll.status).toBe("ANCHORING");
    expect(updateManyMock).toHaveBeenCalledWith({
      where: {
        id: "poll_1",
        status: "DRAFT"
      },
      data: {
        status: "ANCHORING"
      }
    });
  });

  it("only marks anchored polls from anchoring state", async () => {
    const poll = installPollState();

    await buildAndStoreAnchorMemo("poll_1");
    await markPollAnchoring("poll_1", "txid_1");

    expect(poll.status).toBe("SCHEDULED");
    expect(poll.anchorTxid).toBe("txid_1");

    await expect(markPollAnchoring("poll_1", "txid_2")).rejects.toMatchObject({
      code: "POLL_NOT_ANCHORING",
      status: 409
    });
    expect(poll.anchorTxid).toBe("txid_1");
  });

  it("rejects repeated anchoring for non-draft polls", async () => {
    const poll = installPollState();

    await buildAndStoreAnchorMemo("poll_1");

    await expect(buildAndStoreAnchorMemo("poll_1")).rejects.toMatchObject({
      code: "POLL_NOT_DRAFT",
      status: 409
    });
    expect(poll.status).toBe("ANCHORING");
  });

  it("releases an anchoring poll back to draft before a txid is stored", async () => {
    const poll = installPollState();

    await buildAndStoreAnchorMemo("poll_1");
    await releasePollAnchoring("poll_1");

    expect(poll.status).toBe("DRAFT");
    expect(poll.anchorTxid).toBeNull();
  });
});
