import { beforeEach, describe, expect, it, vi } from "vitest";

const { readSessionMock, pollFindUniqueMock, voteReceiptFindManyMock } = vi.hoisted(
  () => ({
    readSessionMock: vi.fn(),
    pollFindUniqueMock: vi.fn(),
    voteReceiptFindManyMock: vi.fn()
  })
);

vi.mock("@/lib/auth/session", () => ({
  readSession: readSessionMock
}));

vi.mock("@/lib/db", () => ({
  db: {
    poll: {
      findUnique: pollFindUniqueMock
    },
    voteReceipt: {
      findMany: voteReceiptFindManyMock
    }
  }
}));

import { GET } from "@/app/api/admin/polls/[pollId]/receipts/route";

beforeEach(() => {
  readSessionMock.mockReset();
  pollFindUniqueMock.mockReset();
  voteReceiptFindManyMock.mockReset();
});

describe("admin receipt summary route", () => {
  it("returns aggregate-only receipt counts without per-transaction fields", async () => {
    readSessionMock.mockResolvedValue({
      userId: "admin_1",
      nick: "admin",
      role: "ADMIN"
    });
    pollFindUniqueMock.mockResolvedValue({
      optionALabel: "Approve",
      optionBLabel: "Reject",
      optionCLabel: "Abstain",
      optionDLabel: null,
      optionELabel: null
    });
    voteReceiptFindManyMock.mockResolvedValue([
      { status: "CONFIRMED", optionLetter: "A" },
      { status: "CONFIRMED", optionLetter: "B" },
      { status: "REJECTED", optionLetter: "B" },
      { status: "DUPLICATE_IGNORED", optionLetter: "A" }
    ]);

    const response = await GET(
      new Request("http://localhost/api/admin/polls/poll_1/receipts") as never,
      { params: Promise.resolve({ pollId: "poll_1" }) } as never
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      summary: {
        totalReceipts: 4,
        statuses: {
          PENDING: 0,
          CONFIRMED: 2,
          REJECTED: 1,
          DUPLICATE_IGNORED: 1
        },
        options: {
          A: {
            label: "Approve",
            total: 2
          },
          B: {
            label: "Reject",
            total: 2
          },
          C: {
            label: "Abstain",
            total: 0
          },
          D: {
            label: "Option D",
            total: 0
          },
          E: {
            label: "Option E",
            total: 0
          }
        }
      }
    });
  });
});
