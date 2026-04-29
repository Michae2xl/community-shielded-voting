const RAW_URL_PATTERN = /https?:\/\/[^\s<>()]+/g;

export function getDisplayUrlLabel(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "Reference";
  }
}

export function splitPollReferences(value: string, fallback: string) {
  const references = Array.from(value.matchAll(RAW_URL_PATTERN), (match) => match[0]);
  const title = value.replace(RAW_URL_PATTERN, " ").replace(/\s+/g, " ").trim();

  return {
    references,
    title: title || fallback
  };
}
