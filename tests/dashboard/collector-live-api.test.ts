import { beforeEach, describe, expect, it, vi } from "vitest";

const { readCollectorTallyMock } = vi.hoisted(() => ({
  readCollectorTallyMock: vi.fn()
}));

vi.mock("@/lib/services/collector-tally", () => ({
  readCollectorTally: readCollectorTallyMock
}));

import { GET } from "@/app/api/collector/live-tally/route";

beforeEach(() => {
  readCollectorTallyMock.mockReset();
});

describe("collector live tally API", () => {
  it("returns the live collector tally", async () => {
    readCollectorTallyMock.mockResolvedValue({
      totalConfirmed: 1,
      counts: {
        A: 1,
        B: 0,
        C: 0,
        D: 0,
        E: 0
      },
      receipts: []
    });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      totalConfirmed: 1,
      counts: {
        A: 1,
        B: 0,
        C: 0,
        D: 0,
        E: 0
      },
      receipts: []
    });
  });
});
