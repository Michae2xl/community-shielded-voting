"use client";

import { useEffect, useState } from "react";
import { AnswerGrid, type AnswerGridOption } from "@/components/answer-grid";
import { QrCard } from "@/components/qr-card";
import type { OptionLetter } from "@/lib/domain/options";

const VOTE_PAGE_REFRESH_MS = 3000;

type PollResponse = {
  poll: {
    id: string;
    question: string;
    activeOptions: OptionLetter[];
    optionLabels: Record<OptionLetter, string>;
    status: string;
    feeZec: string;
    opensAt: string;
    closesAt: string;
  } | null;
};

type VoteRequest = {
  id: string;
  optionLetter: OptionLetter;
  shieldedAddress: string;
  zip321Uri: string;
  status: string;
};

type TicketResponse = {
  ticket: {
    id: string;
    pollId: string;
    ticketPublicId: string;
    status: "ISSUED" | "LOCKED" | "VOTED" | "EXPIRED" | "REVOKED";
    observedVote: boolean;
    lockedOptionLetter: OptionLetter | null;
    lockedRequestId: string | null;
    lockedAt: string | null;
    lockedRequest: VoteRequest | null;
    receipt: {
      receiptPublicId: string | null;
      txid: string;
      confirmedAt: string | null;
    } | null;
    issuedAt: string;
    expiresAt: string | null;
  } | null;
};

type LoadedPoll = NonNullable<PollResponse["poll"]>;
type LoadedTicket = NonNullable<TicketResponse["ticket"]>;

type VotePageState =
  | { kind: "loading" }
  | { kind: "access_error" }
  | { kind: "not_found" }
  | { kind: "not_open"; poll: LoadedPoll }
  | { kind: "no_requests"; poll: LoadedPoll }
  | { kind: "choose"; poll: LoadedPoll; requests: VoteRequest[] }
  | { kind: "locked"; poll: LoadedPoll; ticket: LoadedTicket }
  | { kind: "awaiting_confirmation"; poll: LoadedPoll; ticket: LoadedTicket }
  | { kind: "voted"; poll: LoadedPoll; ticket: LoadedTicket };

function isUnauthorizedStatus(status: number) {
  return status === 401 || status === 403;
}

function shouldKeepRefreshing(state: VotePageState) {
  return (
    state.kind === "loading" ||
    state.kind === "not_open" ||
    state.kind === "choose" ||
    state.kind === "locked" ||
    state.kind === "awaiting_confirmation" ||
    state.kind === "no_requests"
  );
}

function formatLocalDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function describeUpcomingWindow(opensAt: string) {
  const diffMs = new Date(opensAt).getTime() - Date.now();

  if (diffMs <= 0) {
    return "This poll is opening now.";
  }

  const diffMinutes = Math.ceil(diffMs / 60000);

  if (diffMinutes < 60) {
    return `This poll opens in ${diffMinutes} minute${diffMinutes === 1 ? "" : "s"}.`;
  }

  const diffHours = Math.ceil(diffMinutes / 60);

  if (diffHours < 24) {
    return `This poll opens in ${diffHours} hour${diffHours === 1 ? "" : "s"}.`;
  }

  const diffDays = Math.ceil(diffHours / 24);
  return `This poll opens in ${diffDays} day${diffDays === 1 ? "" : "s"}.`;
}

async function loadVotePageState(pollId: string): Promise<VotePageState> {
  const [pollResponse, requestsResponse, ticketResponse] = await Promise.all([
    fetch(`/api/polls/${pollId}`),
    fetch(`/api/polls/${pollId}/my-vote-requests`),
    fetch(`/api/polls/${pollId}/my-ticket`)
  ]);

  if (
    isUnauthorizedStatus(pollResponse.status) ||
    isUnauthorizedStatus(requestsResponse.status) ||
    isUnauthorizedStatus(ticketResponse.status)
  ) {
    return { kind: "access_error" };
  }

  if (pollResponse.status === 404) {
    return { kind: "not_found" };
  }

  if (!pollResponse.ok || !requestsResponse.ok || !ticketResponse.ok) {
    return { kind: "access_error" };
  }

  const pollJson = (await pollResponse.json()) as PollResponse;
  const requestsJson = (await requestsResponse.json()) as {
    requests?: VoteRequest[];
  };
  const ticketJson = (await ticketResponse.json()) as TicketResponse;
  const poll = pollJson.poll;
  const ticket = ticketJson.ticket;

  if (!poll) {
    return { kind: "not_found" };
  }

  if (poll.status !== "OPEN") {
    return {
      kind: "not_open",
      poll
    };
  }

  if (!ticket) {
    return {
      kind: "no_requests",
      poll
    };
  }

  if (ticket.status === "VOTED") {
    return {
      kind: "voted",
      poll,
      ticket
    };
  }

  if (ticket.status === "LOCKED" && ticket.lockedRequest) {
    return ticket.observedVote
      ? {
          kind: "awaiting_confirmation",
          poll,
          ticket
        }
      : {
          kind: "locked",
          poll,
          ticket
        };
  }

  const requests = Array.isArray(requestsJson.requests) ? requestsJson.requests : [];

  if (requests.length === 0) {
    return {
      kind: "no_requests",
      poll
    };
  }

  return {
    kind: "choose",
    poll,
    requests
  };
}

export default function PollVotePageClient({
  pollId
}: {
  pollId: string;
}) {
  const [state, setState] = useState<VotePageState>({ kind: "loading" });
  const [selectedOptionLetter, setSelectedOptionLetter] = useState<OptionLetter | null>(
    null
  );
  const [confirmationChecked, setConfirmationChecked] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const [isLocking, setIsLocking] = useState(false);

  useEffect(() => {
    let active = true;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    async function load() {
      try {
        const nextState = await loadVotePageState(pollId);

        if (!active) {
          return;
        }

        setState(nextState);

        if (shouldKeepRefreshing(nextState)) {
          refreshTimer = setTimeout(() => {
            void load();
          }, VOTE_PAGE_REFRESH_MS);
        }
      } catch {
        if (!active) {
          return;
        }

        setState({ kind: "access_error" });
      }
    }

    setState({ kind: "loading" });
    void load();

    return () => {
      active = false;

      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
    };
  }, [pollId]);

  const poll =
    state.kind === "choose" ||
    state.kind === "locked" ||
    state.kind === "awaiting_confirmation" ||
    state.kind === "voted" ||
    state.kind === "no_requests" ||
    state.kind === "not_open"
      ? state.poll
      : null;
  const selectableRequests = state.kind === "choose" ? state.requests : [];
  const lockedRequest =
    state.kind === "locked" || state.kind === "awaiting_confirmation"
      ? state.ticket.lockedRequest
      : null;
  const receipt = state.kind === "voted" ? state.ticket.receipt : null;
  const options: AnswerGridOption[] = selectableRequests.map((request) => ({
    optionLetter: request.optionLetter,
    label: poll?.optionLabels[request.optionLetter] ?? `Option ${request.optionLetter}`
  }));

  async function handleLockChoice() {
    if (
      state.kind !== "choose" ||
      !selectedOptionLetter ||
      !confirmationChecked ||
      isLocking
    ) {
      return;
    }

    setIsLocking(true);
    setLockError(null);

    try {
      const response = await fetch(`/api/polls/${pollId}/lock-choice`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          optionLetter: selectedOptionLetter,
          confirmed: true
        })
      });

      if (isUnauthorizedStatus(response.status)) {
        setState({ kind: "access_error" });
        return;
      }

      if (!response.ok) {
        setLockError(
          "We could not lock this choice. Reload the page and try again."
        );
        return;
      }

      const nextState = await loadVotePageState(pollId);
      setState(nextState);
      setLockError(null);
    } catch {
      setLockError("We could not lock this choice. Reload the page and try again.");
    } finally {
      setIsLocking(false);
    }
  }

  const heading =
    state.kind === "loading" || state.kind === "access_error" || state.kind === "not_found"
      ? `Poll ${pollId}`
      : poll?.question ?? `Poll ${pollId}`;
  const statusCopy =
    state.kind === "loading"
      ? `Loading access for ${pollId} and preparing your shielded voting session.`
      : state.kind === "access_error"
      ? "We could not verify your access to this poll. Reopen the invite email or sign in again."
      : state.kind === "not_found"
      ? "This poll is not available for your current account. Reopen the invite email or ask the admin to verify access."
      : state.kind === "choose"
      ? `${poll?.status ?? "OPEN"} · choose one option before generating the QR code`
      : state.kind === "locked"
      ? `${poll?.status ?? "OPEN"} · choice ${state.ticket.lockedOptionLetter ?? ""} locked`
      : state.kind === "awaiting_confirmation"
      ? `${poll?.status ?? "OPEN"} · payment detected, waiting for one-block confirmation`
      : state.kind === "voted"
      ? `${poll?.status ?? "OPEN"} · vote confirmed on-chain`
      : `${poll?.status ?? "OPEN"} · ${poll?.activeOptions.length ?? 0} configured options`;
  const accessChip =
    state.kind === "loading"
      ? "Checking access"
      : state.kind === "choose"
      ? "Choose option"
      : state.kind === "locked"
      ? "QR locked"
      : state.kind === "awaiting_confirmation"
      ? "Awaiting confirmation"
      : state.kind === "voted"
      ? "Vote received"
      : state.kind === "no_requests"
      ? "Ticket pending"
      : state.kind === "not_open"
      ? "Not open"
      : "Access issue";
  const bodyMessage =
    state.kind === "loading"
      ? "Fetching your ticket state and ballot options..."
      : state.kind === "access_error"
      ? "Your session expired or this invite is no longer active. Reopen the invite email or sign in again."
      : state.kind === "not_found"
      ? "We could not load this poll for your account. Reopen the invite email or ask the admin to confirm your access."
      : state.kind === "not_open"
      ? state.poll.status === "SCHEDULED"
        ? `${describeUpcomingWindow(state.poll.opensAt)} Opening time: ${formatLocalDateTime(state.poll.opensAt)}.`
        : state.poll.status === "CLOSED" || state.poll.status === "FINALIZED" || state.poll.status === "ARCHIVED"
          ? `This poll is closed. It was scheduled to close on ${formatLocalDateTime(state.poll.closesAt)}.`
          : "Voting is not open for this poll."
      : state.kind === "no_requests"
      ? "Your ticket is active, but the QR request is not ready yet. We are checking again automatically."
      : state.kind === "locked"
      ? "This ticket is locked to the selected option. If you leave and come back, the same QR code will remain available until the poll ends."
      : state.kind === "awaiting_confirmation"
      ? "Payment detected. This ticket remains locked while we wait for one on-chain confirmation."
      : state.kind === "voted"
      ? "Your vote has been confirmed on-chain for this poll. Keep this receipt for your records."
      : null;

  return (
    <main className="page-shell">
      <section className="workspace-shell">
        <header className="hero-card workspace-header">
          <div className="workspace-header-copy">
            <p className="eyebrow">Vote</p>
            <h1 className="workspace-title">{heading}</h1>
            <p className="workspace-copy">{statusCopy}</p>
          </div>
          <div className="meta-chip-row">
            <span className="meta-chip">Poll {pollId}</span>
            <span className="meta-chip">ZIP-321 QR</span>
            <span className="meta-chip meta-chip--mint">{accessChip}</span>
          </div>
        </header>

        <div className="workspace-grid">
          <section className="hero-card form-panel">
            <div className="form-section-intro">
              <p className="section-label">Ballot request</p>
              <h2 className="form-section-title">Choose and lock your answer</h2>
              <p className="form-section-copy">
                Select one answer first. The portal will generate a single QR code
                only after you confirm that choice.
              </p>
            </div>

            {state.kind === "choose" ? (
              <>
                <AnswerGrid
                  options={options}
                  selectedOptionLetter={selectedOptionLetter}
                  onSelect={(option) => {
                    setSelectedOptionLetter(option.optionLetter);
                    setLockError(null);
                  }}
                />
                <div className="confirmation-stack">
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={confirmationChecked}
                      onChange={(event) =>
                        setConfirmationChecked(event.currentTarget.checked)
                      }
                    />
                    <span>
                      I confirm this choice. After generating the QR code, this
                      ticket will remain locked until the poll ends.
                    </span>
                  </label>
                  {selectedOptionLetter ? (
                    <p className="lock-warning">
                      Selected option:{" "}
                      <strong>
                        {selectedOptionLetter} ·{" "}
                        {poll?.optionLabels[selectedOptionLetter] ??
                          `Option ${selectedOptionLetter}`}
                      </strong>
                    </p>
                  ) : null}
                  {lockError ? <p className="lock-error">{lockError}</p> : null}
                  <button
                    type="button"
                    onClick={() => void handleLockChoice()}
                    disabled={!selectedOptionLetter || !confirmationChecked || isLocking}
                  >
                    {isLocking ? "Locking choice..." : "Lock choice and generate QR"}
                  </button>
                </div>
              </>
            ) : (
              <p className="muted-text">{bodyMessage}</p>
            )}
          </section>

          {state.kind === "locked" && lockedRequest ? (
            <section className="qr-panel-stack">
              <QrCard
                uri={lockedRequest.zip321Uri}
                title={`Vote ${lockedRequest.optionLetter} · ${poll?.optionLabels[lockedRequest.optionLetter] ?? `Option ${lockedRequest.optionLetter}`}`}
              />
              <p className="muted-text qr-support-note">
                Payment will be detected, waiting for one-block confirmation. The
                QR code will disappear after confirmation. You can see the votes
                here:{" "}
                <a href="/polls" className="metric-card-link">
                  https://demo.community-shielded-voting.example/polls
                </a>
              </p>
            </section>
          ) : null}
          {state.kind === "voted" ? (
            <section className="hero-card form-panel">
              <div className="form-section-intro">
                <p className="eyebrow">Receipt</p>
                <h2 className="form-section-title">Vote confirmed</h2>
                <p className="form-section-copy">
                  One on-chain confirmation has been recorded for this ticket.
                </p>
              </div>
              <div className="receipt-list">
                <div className="receipt-card">
                  <strong>Receipt ID</strong>
                  <span>{receipt?.receiptPublicId ?? "pending"}</span>
                </div>
                <div className="receipt-card">
                  <strong>Poll ID</strong>
                  <span>{pollId}</span>
                </div>
                <div className="receipt-card">
                  <strong>Confirmed at</strong>
                  <span>{receipt?.confirmedAt ?? "pending"}</span>
                </div>
                <div className="receipt-card">
                  <strong>Txid</strong>
                  <code className="inline-code">{receipt?.txid ?? "pending"}</code>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}
