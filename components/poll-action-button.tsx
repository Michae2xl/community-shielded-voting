"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type PollActionButtonProps = {
  endpoint: string;
  label: string;
  pendingLabel: string;
  disabled?: boolean;
  successMode?: "anchor" | "issue" | "lifecycle" | "reconcile";
};

export function PollActionButton({
  endpoint,
  label,
  pendingLabel,
  disabled,
  successMode
}: PollActionButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAction() {
    setNotice(null);
    setError(null);

    const response = await fetch(endpoint, {
      method: "POST"
    });
    const json = (await response.json().catch(() => null)) as
      | (Record<string, unknown> & { error?: string })
      | null;

    if (!response.ok) {
      setError(json?.error ?? "Action failed");
      return;
    }

    const nextNotice =
      successMode === "anchor"
        ? `Anchor submitted${json?.txid ? ` · ${String(json.txid)}` : ""}.`
        : successMode === "issue"
          ? `Issued ${Number(json?.issued ?? 0)} new tickets.`
          : successMode === "lifecycle"
            ? `Lifecycle ${String(json?.previousStatus ?? "")} -> ${String(json?.status ?? "")}.`
            : successMode === "reconcile"
              ? `Processed ${Number(json?.processed ?? 0)} receipts.`
              : "Action completed.";

    setNotice(nextNotice);
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="stack">
      <button
        type="button"
        className="secondary-button"
        onClick={handleAction}
        disabled={disabled || isPending}
      >
        {isPending ? pendingLabel : label}
      </button>
      {notice ? <p className="muted-text">{notice}</p> : null}
      {error ? <p className="error-notice">{error}</p> : null}
    </div>
  );
}
