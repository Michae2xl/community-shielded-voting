import { after } from "next/server";
import { syncPollLifecycleForPoll } from "@/lib/services/poll-lifecycle";
import { reconcilePollVotes } from "@/lib/services/poll-reconcile";
import { getZkoolClient } from "@/lib/zcash/zkool-client";

const AUTO_RECONCILE_COOLDOWN_MS = 5000;

type AutoReconcileState = {
  inFlight: Map<string, Promise<void>>;
  lastCompletedAt: Map<string, number>;
};

function getAutoReconcileState(): AutoReconcileState {
  const globalState = globalThis as typeof globalThis & {
    __zcapAutoReconcileState?: AutoReconcileState;
  };

  if (!globalState.__zcapAutoReconcileState) {
    globalState.__zcapAutoReconcileState = {
      inFlight: new Map(),
      lastCompletedAt: new Map()
    };
  }

  return globalState.__zcapAutoReconcileState;
}

export async function runAutoPollReconcile(pollId: string) {
  const zkoolClient = getZkoolClient();

  if (!zkoolClient.isConfigured()) {
    return;
  }

  const state = getAutoReconcileState();
  const running = state.inFlight.get(pollId);

  if (running) {
    await running;
    return;
  }

  const lastCompletedAt = state.lastCompletedAt.get(pollId) ?? 0;

  if (Date.now() - lastCompletedAt < AUTO_RECONCILE_COOLDOWN_MS) {
    return;
  }

  const execution = (async () => {
    try {
      await syncPollLifecycleForPoll(pollId);
      await zkoolClient.syncWallet();
      await reconcilePollVotes(pollId);
    } catch (error) {
      console.error("Failed to auto-reconcile poll", {
        pollId,
        error
      });
    } finally {
      state.lastCompletedAt.set(pollId, Date.now());
      state.inFlight.delete(pollId);
    }
  })();

  state.inFlight.set(pollId, execution);
  await execution;
}

export function scheduleAutoPollReconcile(pollId: string) {
  after(async () => {
    await runAutoPollReconcile(pollId);
  });
}
