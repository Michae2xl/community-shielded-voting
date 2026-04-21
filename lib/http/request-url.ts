function trimProtocolSuffix(protocol: string) {
  return protocol.endsWith(":") ? protocol.slice(0, -1) : protocol;
}

export function getRequestOrigin(request: Pick<Request, "headers" | "url">) {
  const fallbackUrl = new URL(request.url);
  const forwardedHost =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");

  if (!forwardedHost) {
    return fallbackUrl.origin;
  }

  const forwardedProto =
    request.headers.get("x-forwarded-proto") ??
    trimProtocolSuffix(fallbackUrl.protocol) ??
    "https";

  return `${forwardedProto}://${forwardedHost}`;
}

export function buildRequestUrl(
  request: Pick<Request, "headers" | "url">,
  pathname: string
) {
  return new URL(pathname, getRequestOrigin(request));
}
