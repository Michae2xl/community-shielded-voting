"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type OpeningStep = {
  id: string;
  label: string;
  endpoint?: string;
  pendingLabel?: string;
};

type StepState = "pending" | "running" | "done" | "error" | "skipped";

export function OpenPollButton({
  pollId,
  hasAnchor,
  hasSentInvites,
  disabled,
  label = "Open poll"
}: {
  pollId: string;
  hasAnchor: boolean;
  hasSentInvites: boolean;
  disabled?: boolean;
  label?: string;
}) {
  const router = useRouter();
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepStates, setStepStates] = useState<Record<string, StepState>>({});
  const [stepMessages, setStepMessages] = useState<Record<string, string>>({});

  const steps = useMemo<OpeningStep[]>(
    () => [
      {
        id: "anchor",
        label: "Anchor rail",
        endpoint: hasAnchor ? undefined : `/api/admin/polls/${pollId}/anchor`
      },
      {
        id: "tickets",
        label: "Issue tickets",
        endpoint: `/api/admin/polls/${pollId}/tickets/issue`
      },
      {
        id: "invites",
        label: "Send invites",
        endpoint: hasSentInvites ? undefined : `/api/admin/polls/${pollId}/invites/send`
      },
      {
        id: "open",
        label: "Open poll",
        endpoint: `/api/admin/polls/${pollId}/lifecycle/sync`
      }
    ],
    [hasAnchor, hasSentInvites, pollId]
  );

  async function handleOpen() {
    setIsOpening(true);
    setError(null);
    setStepMessages({});
    setStepStates(
      Object.fromEntries(
        steps.map((step) => [step.id, step.endpoint ? "pending" : "skipped"])
      )
    );

    for (const step of steps) {
      if (!step.endpoint) {
        continue;
      }

      setStepStates((current) => ({
        ...current,
        [step.id]: "running"
      }));

      const response = await fetch(step.endpoint, {
        method: "POST"
      });
      const json = (await response.json().catch(() => null)) as
        | (Record<string, unknown> & { error?: string })
        | null;

      if (!response.ok) {
        setStepStates((current) => ({
          ...current,
          [step.id]: "error"
        }));
        setError(json?.error ?? `Failed during ${step.label}`);
        setIsOpening(false);
        return;
      }

      const message =
        step.id === "anchor"
          ? `Anchor submitted${json?.txid ? ` · ${String(json.txid)}` : ""}`
          : step.id === "tickets"
            ? `${Number(json?.issued ?? 0)} ticket(s) ready`
            : step.id === "invites"
              ? `${Number(json?.sent ?? 0)} invite(s) sent`
              : `Status ${String(json?.status ?? "updated")}`;

      setStepStates((current) => ({
        ...current,
        [step.id]: "done"
      }));
      setStepMessages((current) => ({
        ...current,
        [step.id]: message
      }));
    }

    setIsOpening(false);
    router.refresh();
  }

  return (
    <div className="editorial-stack">
      <button
        type="button"
        className="button-link button-link-primary"
        onClick={() => void handleOpen()}
        disabled={disabled || isOpening}
      >
        {isOpening ? "Opening..." : label}
      </button>
      <div className="opening-progress">
        {steps.map((step) => {
          const state = stepStates[step.id] ?? (step.endpoint ? "pending" : "skipped");

          return (
            <div key={step.id} className="opening-step">
              <div className="opening-step-head">
                <strong>{step.label}</strong>
                <span className={`opening-step-state opening-step-state--${state}`}>
                  {state}
                </span>
              </div>
              {stepMessages[step.id] ? (
                <p className="muted-text">{stepMessages[step.id]}</p>
              ) : null}
            </div>
          );
        })}
      </div>
      {error ? <p className="error-notice">{error}</p> : null}
    </div>
  );
}
