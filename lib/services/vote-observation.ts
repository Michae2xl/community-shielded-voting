import { getZkoolClient } from "@/lib/zcash/zkool-client";

export async function hasObservedVoteForAddresses(addresses: string[]) {
  if (addresses.length === 0) {
    return false;
  }

  const addressSet = new Set(addresses);
  const notes = await getZkoolClient().fetchIncomingVotes({
    minConfirmations: 0
  });

  return notes.some((note) => addressSet.has(note.shieldedAddress));
}
