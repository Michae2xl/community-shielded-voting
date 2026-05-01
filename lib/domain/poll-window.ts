export const OFFICIAL_POLL_TIME_ZONE = "UTC";
export const MIN_POLL_WINDOW_HOURS = 24;
export const MIN_POLL_WINDOW_MS = MIN_POLL_WINDOW_HOURS * 60 * 60 * 1000;

export function formatOfficialPollDateTime(value: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: OFFICIAL_POLL_TIME_ZONE,
    timeZoneName: "short"
  }).format(value instanceof Date ? value : new Date(value));
}

export function formatPollWindowRange(input: {
  opensAt: Date | string;
  closesAt: Date | string;
}) {
  return `${formatOfficialPollDateTime(input.opensAt)} to ${formatOfficialPollDateTime(input.closesAt)}`;
}
