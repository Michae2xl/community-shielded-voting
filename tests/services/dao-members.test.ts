import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {}
}));

vi.mock("@/lib/db", () => ({
  db: dbMock
}));

import {
  applyDaoMembershipActionForPoll,
  bootstrapDaoMemberBasket
} from "@/lib/services/dao-members";

function resetDbMock() {
  for (const key of Object.keys(dbMock)) {
    delete (dbMock as Record<string, unknown>)[key];
  }
}

beforeEach(() => {
  resetDbMock();
});

describe("DAO member service", () => {
  it("locks direct bootstrap after the basket exists", async () => {
    Object.assign(dbMock, {
      $transaction: vi.fn(async (callback: (tx: typeof dbMock) => Promise<unknown>) =>
        callback({
          daoMember: {
            count: vi.fn(async () => 1)
          }
        } as typeof dbMock)
      )
    });

    await expect(
      bootstrapDaoMemberBasket({
        voters: [{ nick: "michae2xl", signalUsername: "michae2xl.42" }]
      })
    ).rejects.toMatchObject({
      code: "DAO_MEMBER_BOOTSTRAP_LOCKED"
    });
  });

  it("applies an add-member action only after a passed closed poll", async () => {
    const daoMemberCreateMock = vi.fn();
    const daoMembershipActionUpdateMock = vi.fn();

    Object.assign(dbMock, {
      poll: {
        findUnique: vi.fn(async () => ({
          id: "poll_1",
          status: "CLOSED",
          voteModel: "SINGLE_CHOICE",
          quorumPercent: 40,
          passingThresholdPercent: 67,
          tally: {
            totalConfirmed: 1,
            countA: 1
          },
          _count: {
            eligibility: 0,
            voterAccesses: 1
          },
          membershipAction: {
            id: "action_1",
            type: "ADD_MEMBER",
            status: "PENDING",
            nick: "alice",
            signalUsername: "alice_user.99",
            targetMemberId: null
          }
        }))
      },
      $transaction: vi.fn(async (callback: (tx: typeof dbMock) => Promise<unknown>) =>
        callback({
          daoMember: {
            create: daoMemberCreateMock,
            findFirst: vi.fn(async () => null),
            update: vi.fn(),
            updateMany: vi.fn()
          },
          daoMembershipAction: {
            update: daoMembershipActionUpdateMock
          }
        } as typeof dbMock)
      )
    });

    await expect(applyDaoMembershipActionForPoll("poll_1")).resolves.toMatchObject({
      status: "APPLIED",
      outcome: "Passed"
    });
    expect(daoMemberCreateMock).toHaveBeenCalledWith({
      data: {
        nick: "alice",
        signalUsername: "alice_user.99",
        status: "ACTIVE",
        addedByPollId: "poll_1"
      }
    });
    expect(daoMembershipActionUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "APPLIED",
          appliedAt: expect.any(Date)
        })
      })
    );
  });

  it("rejects a membership action when governance does not pass", async () => {
    const daoMembershipActionUpdateMock = vi.fn();

    Object.assign(dbMock, {
      poll: {
        findUnique: vi.fn(async () => ({
          id: "poll_1",
          status: "CLOSED",
          voteModel: "SINGLE_CHOICE",
          quorumPercent: 40,
          passingThresholdPercent: 67,
          tally: {
            totalConfirmed: 0,
            countA: 0
          },
          _count: {
            eligibility: 0,
            voterAccesses: 2
          },
          membershipAction: {
            id: "action_1",
            type: "REMOVE_MEMBER",
            status: "PENDING",
            nick: "alice",
            signalUsername: "alice_user.99",
            targetMemberId: "member_1"
          }
        }))
      },
      daoMembershipAction: {
        update: daoMembershipActionUpdateMock
      },
      $transaction: vi.fn()
    });

    await expect(applyDaoMembershipActionForPoll("poll_1")).resolves.toMatchObject({
      status: "REJECTED",
      outcome: "Quorum not met"
    });
    expect(daoMembershipActionUpdateMock).toHaveBeenCalledWith({
      where: {
        id: "action_1"
      },
      data: {
        status: "REJECTED"
      }
    });
    expect((dbMock as { $transaction: ReturnType<typeof vi.fn> }).$transaction).not.toHaveBeenCalled();
  });
});
