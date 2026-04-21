"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type InviteSendResult = {
  totalEligible: number;
  sent: number;
  failed: number;
  skippedMissingEmail: number;
};

export function SendInvitesButton({
  pollId,
  disabled
}: {
  pollId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setNotice(null);
    setError(null);

    const response = await fetch(`/api/admin/polls/${pollId}/invites/send`, {
      method: "POST"
    });
    const json = (await response.json().catch(() => null)) as
      | (InviteSendResult & { error?: string })
      | null;

    if (!response.ok) {
      setError(json?.error ?? "Failed to send invites");
      return;
    }

    setNotice(
      `Sent ${json?.sent ?? 0}, failed ${json?.failed ?? 0}, missing email ${json?.skippedMissingEmail ?? 0}.`
    );
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="stack">
      <button
        type="button"
        className="primary-button"
        onClick={handleSend}
        disabled={disabled || isPending}
      >
        {isPending ? "Sending invites..." : "Send poll invites"}
      </button>
      {notice ? <p className="muted-text">{notice}</p> : null}
      {error ? <p className="error-notice">{error}</p> : null}
    </div>
  );
}
