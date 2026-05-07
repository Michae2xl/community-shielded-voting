import { normalizeSignalUsername } from "@/lib/domain/signal";

export type PollVoterInput = {
  nick: string;
  signalUsername: string;
};

export class PollVoterParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PollVoterParseError";
  }
}

export function parsePollVoterLines(input: string): PollVoterInput[] {
  const seenNicks = new Set<string>();
  const seenSignalUsernames = new Set<string>();

  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [nickRaw, signalUsernameRaw, ...extra] = line
        .split(",")
        .map((value) => value.trim());

      if (!nickRaw || !signalUsernameRaw || extra.length > 0) {
        throw new PollVoterParseError(`invalid voter row: ${line}`);
      }

      const nick = nickRaw;
      let signalUsername = "";

      try {
        signalUsername = normalizeSignalUsername(signalUsernameRaw);
      } catch {
        throw new PollVoterParseError(`invalid voter row: ${line}`);
      }

      if (seenNicks.has(nick) || seenSignalUsernames.has(signalUsername)) {
        throw new PollVoterParseError(`duplicate voter: ${line}`);
      }

      seenNicks.add(nick);
      seenSignalUsernames.add(signalUsername);

      return { nick, signalUsername };
    });
}
