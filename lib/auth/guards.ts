import { z } from "zod";

export const SESSION_COOKIE_NAME = "zcap_session";

const userSessionPayloadSchema = z.object({
  subjectType: z.literal("user"),
  userId: z.string().min(1),
  nick: z.string().min(1),
  role: z.enum(["ADMIN", "CREATOR", "USER"])
});

const temporaryPollVoterSessionPayloadSchema = z.object({
  subjectType: z.literal("poll_voter_access"),
  userId: z.literal(""),
  pollVoterAccessId: z.string().min(1),
  pollId: z.string().min(1),
  nick: z.string().min(1),
  role: z.literal("VOTER_TEMP")
});

export const sessionPayloadSchema = z.discriminatedUnion("subjectType", [
  userSessionPayloadSchema,
  temporaryPollVoterSessionPayloadSchema
]);

export type SessionPayload = z.infer<typeof sessionPayloadSchema>;
export type UserSessionPayload = z.infer<typeof userSessionPayloadSchema>;
export type TemporaryPollVoterSessionPayload = z.infer<
  typeof temporaryPollVoterSessionPayloadSchema
>;

export function canManagePolls(role: SessionPayload["role"]) {
  return role === "ADMIN" || role === "CREATOR";
}
