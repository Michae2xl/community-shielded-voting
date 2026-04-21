import { createHash } from "node:crypto";

export function buildTicketHash(
  ticketPublicId: string,
  ticketSecret: string
): string {
  return createHash("sha256").update(`${ticketPublicId}:${ticketSecret}`).digest("hex");
}
