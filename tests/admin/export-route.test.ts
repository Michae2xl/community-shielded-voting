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

import { GET } from "@/app/api/admin/polls/[pollId]/export/route";

beforeEach(() => {
  readSessionMock.mockReset();
  pollFindUniqueMock.mockReset();
  voteReceiptFindManyMock.mockReset();
});

describe("admin export route", () => {
  it("exports only aggregated receipt metrics", async () => {
    readSessionMock.mockResolvedValue({
      userId: "admin_1",
      nick: "admin",
      role: "ADMIN"
    });
    pollFindUniqueMock.mockResolvedValue({
      optionALabel: "Approve",
      optionBLabel: "Reject",
      optionCLabel: null,
      optionDLabel: null,
      optionELabel: null
    });
    voteReceiptFindManyMock.mockResolvedValue([
      { status: "CONFIRMED", optionLetter: "A" },
      { status: "REJECTED", optionLetter: "B" }
    ]);

    const response = await GET(
      new Request("http://localhost/api/admin/polls/poll_1/export") as never,
      { params: Promise.resolve({ pollId: "poll_1" }) } as never
    );

    expect(response.status).toBe(200);
    const csv = await response.text();
    expect(csv).toContain("metric,value");
    expect(csv).toContain("total_receipts,2");
    expect(csv).toContain("status_confirmed,1");
    expect(csv).toContain("status_rejected,1");
    expect(csv).toContain("option_A_label,Approve");
    expect(csv).toContain("option_A_total,1");
    expect(csv).toContain("option_B_label,Reject");
    expect(csv).toContain("option_B_total,1");
    expect(csv).not.toContain("txid");
    expect(csv).not.toContain("confirmed_at");
    expect(csv).not.toContain("block_height");
  });
});
