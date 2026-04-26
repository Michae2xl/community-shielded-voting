import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  syncPollLifecycleForPollMock,
  reconcilePollVotesMock,
  syncObservedVoteAuditEventsMock,
  syncWalletMock,
  isConfiguredMock
} = vi.hoisted(() => ({
  syncPollLifecycleForPollMock: vi.fn(),
  reconcilePollVotesMock: vi.fn(),
  syncObservedVoteAuditEventsMock: vi.fn(),
  syncWalletMock: vi.fn(),
  isConfiguredMock: vi.fn()
}));

vi.mock("@/lib/services/poll-lifecycle", () => ({
  syncPollLifecycleForPoll: syncPollLifecycleForPollMock
}));

vi.mock("@/lib/services/poll-reconcile", () => ({
  reconcilePollVotes: reconcilePollVotesMock
}));

vi.mock("@/lib/services/public-audit-events", () => ({
  syncObservedVoteAuditEvents: syncObservedVoteAuditEventsMock
}));

vi.mock("@/lib/zcash/zkool-client", () => ({
  getZkoolClient: () => ({
    isConfigured: isConfiguredMock,
    syncWallet: syncWalletMock
  })
}));

import { runAutoPollReconcile } from "@/lib/services/poll-auto-reconcile";

beforeEach(() => {
  const globalState = globalThis as typeof globalThis & {
    __zcapAutoReconcileState?: {
      inFlight: Map<string, Promise<void>>;
      lastCompletedAt: Map<string, number>;
    };
  };

  delete globalState.__zcapAutoReconcileState;
  syncPollLifecycleForPollMock.mockReset();
  reconcilePollVotesMock.mockReset();
  syncObservedVoteAuditEventsMock.mockReset();
  syncWalletMock.mockReset();
  isConfiguredMock.mockReset();
  isConfiguredMock.mockReturnValue(true);
  syncPollLifecycleForPollMock.mockResolvedValue(null);
  syncObservedVoteAuditEventsMock.mockResolvedValue({ created: 0, scanned: 0 });
  reconcilePollVotesMock.mockResolvedValue({ processed: 1 });
  syncWalletMock.mockResolvedValue({ ok: true });
});

describe("runAutoPollReconcile", () => {
  it("does nothing when the collector is not configured", async () => {
    isConfiguredMock.mockReturnValue(false);

    await runAutoPollReconcile("poll_1");

    expect(syncPollLifecycleForPollMock).not.toHaveBeenCalled();
    expect(syncWalletMock).not.toHaveBeenCalled();
    expect(syncObservedVoteAuditEventsMock).not.toHaveBeenCalled();
    expect(reconcilePollVotesMock).not.toHaveBeenCalled();
  });

  it("coalesces concurrent calls for the same poll into a single run", async () => {
    let release: (() => void) | null = null;
    syncWalletMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ ok: true });
        })
    );

    const first = runAutoPollReconcile("poll_1");
    const second = runAutoPollReconcile("poll_1");

    await Promise.resolve();

    expect(syncPollLifecycleForPollMock).toHaveBeenCalledTimes(1);
    expect(syncWalletMock).toHaveBeenCalledTimes(1);
    expect(syncObservedVoteAuditEventsMock).not.toHaveBeenCalled();
    expect(reconcilePollVotesMock).not.toHaveBeenCalled();

    release?.();
    await Promise.all([first, second]);

    expect(syncObservedVoteAuditEventsMock).toHaveBeenCalledTimes(1);
    expect(syncObservedVoteAuditEventsMock).toHaveBeenCalledWith({
      pollId: "poll_1"
    });
    expect(reconcilePollVotesMock).toHaveBeenCalledTimes(1);
    expect(reconcilePollVotesMock).toHaveBeenCalledWith("poll_1");
  });
});
