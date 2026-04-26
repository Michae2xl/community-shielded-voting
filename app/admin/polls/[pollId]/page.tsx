import Link from "next/link";
import { AdminDeliveryManager } from "@/components/admin-delivery-manager";
import { AdminVotersManager } from "@/components/admin-voters-manager";
import { MarkdownText } from "@/components/markdown-text";
import { OpenPollButton } from "@/components/open-poll-button";
import { PollActionButton } from "@/components/poll-action-button";
import { ZcashBrandmark } from "@/components/zcash-brandmark";
import { canManagePolls } from "@/lib/auth/guards";
import {
  getPollOptionEntries,
  type OptionLetter
} from "@/lib/domain/options";
import { readSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { buildAdminReceiptSummary } from "@/lib/services/admin-receipts";
import { readPollCollectorTally } from "@/lib/services/collector-tally";
import { getZkoolClient } from "@/lib/zcash/zkool-client";

const TAB_LABELS = {
  summary: "Summary",
  voters: "Voters",
  delivery: "Delivery",
  results: "Results"
} as const;

type DashboardTab = keyof typeof TAB_LABELS;

function formatDateTime(value: Date | null) {
  if (!value) {
    return "Pending";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC"
  }).format(value);
}

function presentStatus(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function tallyCountForLetter(
  tally: {
    countA: number;
    countB: number;
    countC: number;
    countD: number;
    countE: number;
  },
  letter: OptionLetter
) {
  switch (letter) {
    case "A":
      return tally.countA;
    case "B":
      return tally.countB;
    case "C":
      return tally.countC;
    case "D":
      return tally.countD;
    case "E":
      return tally.countE;
  }
}

function MetricCard({
  label,
  value
}: {
  label: string;
  value: string | number;
}) {
  return (
    <article className="metric-card editorial-metric-card">
      <span className="metric-card-label">{label}</span>
      <strong className="metric-card-value">{value}</strong>
    </article>
  );
}

function resolveTab(raw?: string): DashboardTab {
  if (raw === "voters" || raw === "delivery" || raw === "results") {
    return raw;
  }

  return "summary";
}

export default async function AdminPollPage({
  params,
  searchParams
}: {
  params: Promise<{ pollId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await readSession();
  const { pollId } = await params;
  const { tab } = await searchParams;
  const activeTab = resolveTab(tab);

  if (!session) {
    return (
      <main className="page-shell">
        <section className="workspace-shell">
          <Link href="/admin/polls" className="admin-back-link">
            <span aria-hidden="true">←</span>
            <span>Polls</span>
          </Link>
          <section className="hero-card editorial-panel">
            <p className="eyebrow">Admin</p>
            <h1 className="editorial-title editorial-title--compact">Sign in to view this poll.</h1>
          </section>
        </section>
      </main>
    );
  }

  if (!canManagePolls(session.role)) {
    return (
      <main className="page-shell">
        <section className="workspace-shell">
          <Link href="/admin/polls" className="admin-back-link">
            <span aria-hidden="true">←</span>
            <span>Polls</span>
          </Link>
          <section className="hero-card editorial-panel">
            <p className="eyebrow">Admin</p>
            <h1 className="editorial-title editorial-title--compact">You do not have access to this dashboard.</h1>
          </section>
        </section>
      </main>
    );
  }

  const poll = await db.poll.findFirst({
    where: {
      id: pollId,
      createdById: session.userId
    },
    select: {
      id: true,
      question: true,
      optionALabel: true,
      optionBLabel: true,
      optionCLabel: true,
      optionDLabel: true,
      optionELabel: true,
      status: true,
      opensAt: true,
      closesAt: true,
      anchorTxid: true,
      invites: {
        select: {
          status: true,
          pollVoterAccessId: true
        }
      },
      voterAccesses: {
        orderBy: {
          createdAt: "asc"
        },
        select: {
          id: true,
          nick: true,
          email: true,
          invites: {
            select: {
              status: true
            }
          },
          assignments: {
            select: {
              ticket: {
                select: {
                  status: true
                }
              }
            }
          }
        }
      },
      tally: {
        select: {
          countA: true,
          countB: true,
          countC: true,
          countD: true,
          countE: true,
          totalConfirmed: true,
          updatedAt: true
        }
      }
    }
  });

  if (!poll) {
    return (
      <main className="page-shell">
        <section className="workspace-shell">
          <Link href="/admin/polls" className="admin-back-link">
            <span aria-hidden="true">←</span>
            <span>Polls</span>
          </Link>
          <section className="hero-card editorial-panel">
            <p className="eyebrow">Admin</p>
            <h1 className="editorial-title editorial-title--compact">Poll not found or not available for this account.</h1>
          </section>
        </section>
      </main>
    );
  }

  const receipts = await db.voteReceipt.findMany({
    where: {
      pollId: poll.id
    },
    select: {
      optionLetter: true,
      status: true
    }
  });
  const collectorConfigured = getZkoolClient().isConfigured();
  const collectorLive = collectorConfigured
    ? await readPollCollectorTally(poll.id)
    : null;

  const tally = poll.tally ?? {
    countA: 0,
    countB: 0,
    countC: 0,
    countD: 0,
    countE: 0,
    totalConfirmed: 0,
    updatedAt: null
  };
  const optionEntries = getPollOptionEntries(poll);
  const receiptSummary = buildAdminReceiptSummary(poll, receipts);
  const sentInviteCount = poll.invites.filter(
    (invite) => invite.status === "SENT" || invite.status === "OPENED"
  ).length;
  const openedInviteCount = poll.invites.filter(
    (invite) => invite.status === "OPENED"
  ).length;
  const failedInviteCount = poll.invites.filter(
    (invite) => invite.status === "FAILED"
  ).length;
  const completedVoterCount = poll.voterAccesses.filter((access) =>
    access.assignments.some((assignment) => assignment.ticket.status === "VOTED")
  ).length;
  const emailDeliveryConfigured = Boolean(
    process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL
  );
  const hasSentInvites = sentInviteCount > 0 || openedInviteCount > 0;
  const voterRows = poll.voterAccesses.map((access) => {
    const ticketStatuses = access.assignments.map((assignment) => assignment.ticket.status);
    const inviteStatuses = access.invites.map((invite) => invite.status);
    const hasCompletedVote = ticketStatuses.includes("VOTED");
    const inviteStatus = hasCompletedVote
      ? "Vote received"
      : inviteStatuses.includes("OPENED")
        ? "Opened"
        : inviteStatuses.includes("SENT")
          ? "Sent"
          : inviteStatuses.includes("FAILED")
            ? "Failed"
            : "Pending";
    const statusTone = hasCompletedVote
      ? "success"
      : inviteStatus === "Failed"
        ? "warning"
        : "neutral";
    const canRemove = inviteStatuses.length === 0 && ticketStatuses.length === 0;

    return {
      id: access.id,
      nick: access.nick,
      email: access.email,
      inviteStatus,
      statusTone,
      canRemove,
      canSelect: !hasCompletedVote
    } as const;
  });

  return (
    <main className="page-shell">
      <section className="workspace-shell">
        <Link href="/admin/polls" className="admin-back-link">
          <span aria-hidden="true">←</span>
          <span>Polls</span>
        </Link>

        <header className="hero-card editorial-panel editorial-panel--wide">
          <div className="editorial-section-head">
            <div>
              <div className="eyebrow-row">
                <p className="eyebrow">Admin dashboard</p>
                <ZcashBrandmark className="zcash-brandmark--compact" />
              </div>
              <MarkdownText
                value={poll.question}
                className="editorial-title"
                headingLevel={1}
              />
            </div>
            <div className="editorial-inline-actions">
              <span className="status-pill">{presentStatus(poll.status)}</span>
              <span className="status-pill">Poll {poll.id}</span>
            </div>
          </div>
          <p className="editorial-copy editorial-copy--wide">
            Review the poll, keep the voter list editable, resend delivery by
            selection, and treat results in two layers: reconciled result first,
            collector observation second.
          </p>
          <div className="editorial-card-grid">
            <article className="editorial-note-card">
              <span className="section-label">Window</span>
              <strong>Opens {formatDateTime(poll.opensAt)}</strong>
              <p>Closes {formatDateTime(poll.closesAt)}</p>
            </article>
            <article className="editorial-note-card">
              <span className="section-label">Opening state</span>
              <strong>{poll.anchorTxid ? "Anchor ready" : "Awaiting anchor"}</strong>
              <p>{hasSentInvites ? "Initial invites already went out." : "Initial invites still pending."}</p>
            </article>
            <article className="editorial-note-card">
              <span className="section-label">Voters</span>
              <strong>
                {completedVoterCount}/{poll.voterAccesses.length} completed
              </strong>
              <p>{sentInviteCount} invite(s) sent so far.</p>
            </article>
          </div>
          <div className="editorial-tab-row" role="tablist" aria-label="Poll dashboard tabs">
            {Object.entries(TAB_LABELS).map(([value, label]) => (
              <Link
                key={value}
                href={`/admin/polls/${poll.id}?tab=${value}`}
                className={
                  activeTab === value ? "editorial-tab editorial-tab--active" : "editorial-tab"
                }
              >
                {label}
              </Link>
            ))}
          </div>
        </header>

        {activeTab === "summary" ? (
          <div className="editorial-grid editorial-grid--dashboard">
            <section className="hero-card editorial-panel">
              <div className="editorial-section-head">
                <div>
                  <p className="section-label">Open poll</p>
                  <h2 className="editorial-title editorial-title--compact">One guided sequence.</h2>
                </div>
                <span className="status-pill">Operations first</span>
              </div>
              <p className="editorial-copy editorial-copy--wide">
                Use one primary action to move from review to a live poll. The screen
                shows each stage instead of making you guess whether the chain or
                delivery step already ran.
              </p>
              <OpenPollButton
                pollId={poll.id}
                hasAnchor={Boolean(poll.anchorTxid)}
                hasSentInvites={hasSentInvites}
                disabled={
                  !emailDeliveryConfigured || poll.status === "OPEN" || poll.status === "CLOSED"
                }
                label={poll.status === "DRAFT" ? "Open poll" : "Retry opening"}
              />
              {!emailDeliveryConfigured ? (
                <p className="error-notice">
                  Configure <code>RESEND_API_KEY</code> and <code>RESEND_FROM_EMAIL</code>{" "}
                  before opening this poll.
                </p>
              ) : null}
              <div className="subtle-rule" />
              <div className="editorial-section-head">
                <div>
                  <p className="section-label">Advanced actions</p>
                  <h3>Use only when you need to intervene.</h3>
                </div>
              </div>
              <div className="admin-action-grid">
                <PollActionButton
                  endpoint={`/api/admin/polls/${poll.id}/anchor`}
                  label="Anchor rail"
                  pendingLabel="Anchoring..."
                  disabled={Boolean(poll.anchorTxid) || poll.status !== "DRAFT"}
                  successMode="anchor"
                />
                <PollActionButton
                  endpoint={`/api/admin/polls/${poll.id}/tickets/issue`}
                  label="Issue tickets"
                  pendingLabel="Issuing..."
                  successMode="issue"
                />
                <PollActionButton
                  endpoint={`/api/admin/polls/${poll.id}/lifecycle/sync`}
                  label="Sync status"
                  pendingLabel="Syncing..."
                  successMode="lifecycle"
                />
                <PollActionButton
                  endpoint={`/api/admin/polls/${poll.id}/reconcile`}
                  label="Reconcile now"
                  pendingLabel="Reconciling..."
                  successMode="reconcile"
                />
              </div>
            </section>

            <section className="hero-card editorial-panel">
              <div className="editorial-section-head">
                <div>
                  <p className="section-label">Poll structure</p>
                  <h2 className="editorial-title editorial-title--compact">
                    Visible answers and delivery state.
                  </h2>
                </div>
              </div>
              <div className="editorial-card-grid">
                {optionEntries.map((entry) => (
                  <article key={entry.letter} className="editorial-note-card">
                    <span className="section-label">{entry.letter}</span>
                    <strong>{entry.label}</strong>
                    <p>Visible to the voter, mapped to one dedicated rail request.</p>
                  </article>
                ))}
              </div>
              <div className="editorial-metric-grid">
                <MetricCard label="Sent" value={sentInviteCount} />
                <MetricCard label="Opened" value={openedInviteCount} />
                <MetricCard label="Failed" value={failedInviteCount} />
                <MetricCard
                  label="Completed voters"
                  value={`${completedVoterCount}/${poll.voterAccesses.length}`}
                />
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "voters" ? (
          <section className="hero-card editorial-panel editorial-panel--wide">
            <div className="editorial-section-head">
              <div>
                <p className="section-label">Voters</p>
                <h2 className="editorial-title editorial-title--compact">
                  Keep the roster clear and editable.
                </h2>
              </div>
            </div>
            <p className="editorial-copy editorial-copy--wide">
              Add voters one by one or in bulk. Rows that were never invited can be
              removed. Once an invite exists, the row stays for audit and access.
            </p>
            <AdminVotersManager pollId={poll.id} rows={voterRows} />
          </section>
        ) : null}

        {activeTab === "delivery" ? (
          <section className="hero-card editorial-panel editorial-panel--wide">
            <div className="editorial-section-head">
              <div>
                <p className="section-label">Delivery</p>
                <h2 className="editorial-title editorial-title--compact">
                  Resend only the rows you select.
                </h2>
              </div>
            </div>
            <p className="editorial-copy editorial-copy--wide">
              Use this after the poll is already live or after you add new voters.
              Pending rows stay inactive until you explicitly resend them.
            </p>
            <AdminDeliveryManager pollId={poll.id} rows={voterRows} />
          </section>
        ) : null}

        {activeTab === "results" ? (
          <div className="editorial-grid editorial-grid--dashboard">
            <section className="hero-card editorial-panel">
              <div className="editorial-section-head">
                <div>
                  <p className="section-label">Results</p>
                  <h2 className="editorial-title editorial-title--compact">
                    Reconciled result
                  </h2>
                </div>
                <span className="status-pill">Primary</span>
              </div>
              <p className="editorial-copy editorial-copy--wide">
                Valid votes after duplicate protection. This is the number to trust
                for admin decision-making.
              </p>
              <div className="editorial-metric-grid">
                <MetricCard label="Confirmed" value={tally.totalConfirmed} />
                {optionEntries.map((entry) => (
                  <MetricCard
                    key={entry.letter}
                    label={`${entry.letter} · ${entry.label}`}
                    value={tallyCountForLetter(tally, entry.letter)}
                  />
                ))}
              </div>
              <p className="muted-text">Updated {formatDateTime(tally.updatedAt)}</p>
            </section>

            <section className="hero-card editorial-panel">
              <div className="editorial-section-head">
                <div>
                  <p className="section-label">Collector observed</p>
                  <h2 className="editorial-title editorial-title--compact">Network intake</h2>
                </div>
                <span className="status-pill">Secondary</span>
              </div>
              <p className="editorial-copy editorial-copy--wide">
                Notes already seen by the collector wallet. Useful for early signal,
                but not the final result layer.
              </p>
              <div className="editorial-metric-grid">
                {collectorLive ? (
                  <>
                    <MetricCard label="Collector confirmed" value={collectorLive.totalConfirmed} />
                    {optionEntries.map((entry) => (
                      <MetricCard
                        key={`collector-${entry.letter}`}
                        label={`${entry.letter} · ${entry.label}`}
                        value={collectorLive.counts[entry.letter]}
                      />
                    ))}
                  </>
                ) : (
                  <MetricCard label="Collector status" value="Unavailable" />
                )}
              </div>
            </section>

            <section className="hero-card editorial-panel editorial-panel--wide">
              <div className="editorial-section-head">
                <div>
                  <p className="section-label">Voter completion</p>
                  <h2 className="editorial-title editorial-title--compact">
                    Completion without answer exposure.
                  </h2>
                </div>
              </div>
              <div className="editorial-table-wrap">
                <table className="editorial-table">
                  <thead>
                    <tr>
                      <th>Nick</th>
                      <th>Email</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {voterRows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.nick}</td>
                        <td>{row.email}</td>
                        <td>
                          <span className={`status-pill status-pill--${row.statusTone}`}>
                            {row.inviteStatus === "Vote received"
                              ? "Vote received / voter completed"
                              : row.inviteStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="subtle-rule" />

              <div className="editorial-section-head">
                <div>
                  <p className="section-label">Audit and export</p>
                  <h3>Secondary tools stay available.</h3>
                </div>
              </div>
              <div className="editorial-metric-grid">
                <MetricCard label="Total receipts" value={receiptSummary.totalReceipts} />
                <MetricCard label="Confirmed" value={receiptSummary.statuses.CONFIRMED} />
                <MetricCard label="Duplicate ignored" value={receiptSummary.statuses.DUPLICATE_IGNORED} />
                <MetricCard label="Rejected" value={receiptSummary.statuses.REJECTED} />
                <MetricCard label="Pending" value={receiptSummary.statuses.PENDING} />
              </div>
              <div className="editorial-inline-actions">
                <Link href={`/api/polls/${poll.id}/status`} className="secondary-button">
                  Status API
                </Link>
                <Link href={`/api/admin/polls/${poll.id}/receipts`} className="secondary-button">
                  Receipt summary
                </Link>
                <Link href={`/api/admin/polls/${poll.id}/collector-live`} className="secondary-button">
                  Collector API
                </Link>
                <a href={`/api/admin/polls/${poll.id}/export`} className="secondary-button">
                  Export CSV
                </a>
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}
