import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export async function creatorOwnsPoll(pollId: string, userId: string) {
  const poll = await db.poll.findFirst({
    where: {
      id: pollId,
      createdById: userId
    },
    select: {
      id: true
    }
  });

  return Boolean(poll);
}

export async function findOwnedPoll<T extends Prisma.PollSelect>(
  pollId: string,
  userId: string,
  select: T
) {
  return db.poll.findFirst({
    where: {
      id: pollId,
      createdById: userId
    },
    select
  }) as Promise<Prisma.PollGetPayload<{ select: T }> | null>;
}
