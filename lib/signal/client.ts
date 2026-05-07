import { normalizeSignalUsername } from "@/lib/domain/signal";

type SignalMessageInput = {
  to: string;
  message: string;
};

type SignalSendResponse = {
  timestamp?: string | number;
};

function getSignalApiUrl() {
  return (process.env.SIGNAL_API_URL ?? "").replace(/\/+$/g, "");
}

function getSignalSender() {
  return process.env.SIGNAL_SENDER ?? "";
}

function getSignalApiToken() {
  return process.env.SIGNAL_API_TOKEN ?? "";
}

export function isSignalDeliveryConfigured() {
  return Boolean(getSignalApiUrl() && getSignalSender());
}

export async function sendSignalMessage(input: SignalMessageInput) {
  const apiUrl = getSignalApiUrl();
  const sender = getSignalSender();

  if (!apiUrl || !sender) {
    throw new Error("SIGNAL_API_URL and SIGNAL_SENDER must be configured");
  }

  const headers: Record<string, string> = {
    "content-type": "application/json"
  };
  const token = getSignalApiToken();

  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${apiUrl}/v2/send`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      number: sender,
      recipients: [normalizeSignalUsername(input.to)],
      message: input.message
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      detail
        ? `Signal delivery failed (${response.status}): ${detail}`
        : `Signal delivery failed (${response.status})`
    );
  }

  const json = (await response.json().catch(() => null)) as SignalSendResponse | null;

  return {
    id: json?.timestamp ? String(json.timestamp) : `signal:${Date.now()}`
  };
}
