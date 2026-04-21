import { z } from "zod";

const emailSchema = z.string().email();

export type PollVoterInput = {
  nick: string;
  email: string;
};

export class PollVoterParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PollVoterParseError";
  }
}

export function parsePollVoterLines(input: string): PollVoterInput[] {
  const seenNicks = new Set<string>();
  const seenEmails = new Set<string>();

  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [nickRaw, emailRaw, ...extra] = line.split(",").map((value) => value.trim());

      if (!nickRaw || !emailRaw || extra.length > 0) {
        throw new PollVoterParseError(`invalid voter row: ${line}`);
      }

      const nick = nickRaw;
      const email = emailSchema
        .parse(emailRaw, {
          errorMap: () => ({ message: `invalid voter row: ${line}` })
        })
        .toLowerCase();

      if (seenNicks.has(nick) || seenEmails.has(email)) {
        throw new PollVoterParseError(`duplicate voter: ${line}`);
      }

      seenNicks.add(nick);
      seenEmails.add(email);

      return { nick, email };
    });
}
