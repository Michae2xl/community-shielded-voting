import { z } from "zod";

const SIGNAL_USERNAME_PATTERN = /^[a-z0-9_]{3,32}\.[0-9]{2,}$/;
const SIGNAL_USERNAME_URL_PREFIX = "https://signal.me/#u/";

function stripSignalUsernamePrefix(value: string) {
  const trimmed = value.trim();

  if (trimmed.toLowerCase().startsWith(SIGNAL_USERNAME_URL_PREFIX)) {
    return trimmed.slice(SIGNAL_USERNAME_URL_PREFIX.length);
  }

  if (trimmed.toLowerCase().startsWith("u:")) {
    return trimmed.slice(2);
  }

  return trimmed;
}

export function normalizeSignalUsername(value: string) {
  const candidate = stripSignalUsernamePrefix(value).toLowerCase();

  if (
    !candidate ||
    candidate.startsWith("+") ||
    /^\+?[0-9][0-9\s().-]{6,}$/.test(candidate) ||
    !SIGNAL_USERNAME_PATTERN.test(candidate)
  ) {
    throw new Error("invalid Signal username");
  }

  return candidate;
}

export function displaySignalUsername(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value.startsWith("u:") ? value.slice(2) : value;
}

export const signalUsernameSchema = z.string().transform((value, ctx) => {
  try {
    return normalizeSignalUsername(value);
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "Use a Signal username, not a phone number. Example: username.42"
    });
    return z.NEVER;
  }
});
