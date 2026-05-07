import Link from "next/link";
import { MarkdownInline } from "@/components/markdown-text";
import { readSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  calculateSingleChoiceOutcome,
  presentGovernanceOutcome
} from "@/lib/domain/governance";
import { getPollOptionEntries } from "@/lib/domain/options";
import {
  getDisplayUrlLabel,
  splitPollReferences
} from "@/lib/domain/poll-references";

function formatVoteCount(totalConfirmed: number) {
  return `${totalConfirmed} valid vote${totalConfirmed === 1 ? "" : "s"}`;
}

function formatVotePercentage(count: number, totalConfirmed: number) {
  if (totalConfirmed === 0) {
    return "0%";
  }

  return `${Math.round((count / totalConfirmed) * 100)}%`;
}

function formatTurnout(completed: number, total: number) {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    percent: `${percent}%`,
    detail: `${completed}/${total} voted`
  };
}

function isClosedPoll(status: string) {
  return status === "CLOSED" || status === "FINALIZED" || status === "ARCHIVED";
}

export default async function PollsPage() {
  const session = await readSession();
  const now = new Date();

  const polls = await db.poll.findMany({
    where: {
      OR: [
        {
          status: "OPEN" as const,
          closesAt: {
            gt: now
          }
        },
        {
          status: {
            in: ["CLOSED", "FINALIZED", "ARCHIVED"] as const
          }
        }
      ]
    },
    orderBy: [
      {
        closesAt: "desc"
      },
      {
        createdAt: "desc"
      }
    ],
    select: {
      id: true,
      question: true,
      status: true,
      voteModel: true,
      quorumPercent: true,
      passingThresholdPercent: true,
      optionALabel: true,
      optionBLabel: true,
      optionCLabel: true,
      optionDLabel: true,
      optionELabel: true,
      tally: {
        select: {
          countA: true,
          countB: true,
          countC: true,
          countD: true,
          countE: true,
          totalConfirmed: true
        }
      },
      _count: {
        select: {
          eligibility: true,
          voterAccesses: true
        }
      }
    }
  });
  const openCount = polls.filter((poll) => poll.status === "OPEN").length;
  const closedCount = polls.length - openCount;

  return (
    <main className="page-shell">
      <section className="workspace-shell">
        <Link href="/" className="admin-back-link">
          <span aria-hidden="true">←</span>
          <span>Overview</span>
        </Link>

        <header className="hero-card workspace-header">
          <div className="workspace-header-copy">
            <p className="eyebrow">
              {session ? (session.role === "ADMIN" ? "Admin view" : "Signed-in view") : "Public board"}
            </p>
            <h1 className="workspace-title">Polls</h1>
            <p className="workspace-copy">
              This board stays public and read-only. It shows live and closed polls
              with their question, poll ID, status, and reconciled percentage split.
              Direct voting still happens only through the invite link or a signed-in
              poll URL.
            </p>
          </div>
          <div className="portal-actions">
            {!session ? (
              <Link href="/login" className="button-link button-link-primary">
                Sign in
              </Link>
            ) : null}
            <span className="meta-chip">Reconciled</span>
            <span className="meta-chip">Read only</span>
            <Link href="/rss.xml" className="meta-chip">
              RSS
            </Link>
            <Link href="/atom.xml" className="meta-chip">
              Atom
            </Link>
            <span className="meta-chip meta-chip--mint">{openCount} OPEN</span>
            <span className="meta-chip">{closedCount} CLOSED</span>
          </div>
        </header>

        <section className="hero-card form-panel">
          <div className="form-section-intro">
            <p className="section-label">Poll directory</p>
            <h2 className="form-section-title">Public poll archive</h2>
            <p className="form-section-copy">
              Each poll shows only the validated public result, with duplicate
              protection already applied before the percentages are rendered.
            </p>
          </div>
          <div className="stack">
            {polls.length ? (
              polls.map((poll) => {
                const questionParts = splitPollReferences(poll.question, `Poll ${poll.id}`);
                const tally = poll.tally ?? {
                  totalConfirmed: 0,
                  countA: 0,
                  countB: 0,
                  countC: 0,
                  countD: 0,
                  countE: 0
                };
                const count = (
                  poll as {
                    _count?: {
                      eligibility: number;
                      voterAccesses: number;
                    };
                  }
                )._count;
                const eligibleTotal = (count?.eligibility ?? 0) + (count?.voterAccesses ?? 0);
                const turnout = formatTurnout(tally.totalConfirmed, eligibleTotal);
                const showTurnout = isClosedPoll(poll.status) && eligibleTotal > 0;
                const outcome = calculateSingleChoiceOutcome({
                  isClosed: isClosedPoll(poll.status),
                  totalEligible: eligibleTotal,
                  totalConfirmed: tally.totalConfirmed,
                  countA: tally.countA,
                  voteModel: (
                    poll as {
                      voteModel?: string | null;
                    }
                  ).voteModel,
                  quorumPercent: (
                    poll as {
                      quorumPercent?: number | null;
                    }
                  ).quorumPercent,
                  passingThresholdPercent: (
                    poll as {
                      passingThresholdPercent?: number | null;
                    }
                  ).passingThresholdPercent
                });
                const showOutcome = showTurnout && outcome.outcome !== "PENDING";

                return (
                  <article key={poll.id} className="poll-summary-card">
                    <div className="poll-summary-head">
                      <div className="poll-summary-copy">
                        <p className="section-label">
                          {poll.status === "OPEN" ? "Live poll" : "Closed poll"}
                        </p>
                        <strong>
                          <MarkdownInline value={questionParts.title} />
                        </strong>
                        {questionParts.references.length ? (
                          <div
                            className="vote-reference-row poll-summary-reference-row"
                            aria-label="Poll references"
                          >
                            {questionParts.references.map((reference, index) => (
                              <a
                                key={`${poll.id}-${reference}-${index}`}
                                className="vote-reference-link"
                                href={reference}
                                rel="noopener noreferrer"
                                target="_blank"
                                title={reference}
                              >
                                <span className="vote-reference-label">Reference link</span>
                                <span className="vote-reference-domain">
                                  {getDisplayUrlLabel(reference)}
                                </span>
                                <span className="vote-reference-action">Open</span>
                              </a>
                            ))}
                          </div>
                        ) : null}
                        <span className="muted-text">Poll ID: {poll.id}</span>
                      </div>
                      <span className="meta-chip meta-chip--mint poll-summary-status">
                        {poll.status}
                      </span>
                    </div>
                    <p className="poll-summary-total">
                      {formatVoteCount(tally.totalConfirmed)}
                    </p>
                    {showTurnout ? (
                      <div className="poll-summary-turnout" aria-label="Turnout">
                        <span>Turnout</span>
                        <strong>{turnout.percent}</strong>
                        <span>{turnout.detail}</span>
                        <span>Quorum {outcome.quorumPercent}%</span>
                      </div>
                    ) : null}
                    {showOutcome ? (
                      <div className="poll-summary-decision" aria-label="Governance outcome">
                        <span>Decision</span>
                        <strong>{presentGovernanceOutcome(outcome.outcome)}</strong>
                        <span>
                          Approval {outcome.approvalPercent}% /{" "}
                          {outcome.passingThresholdPercent}%
                        </span>
                      </div>
                    ) : null}
                    <div className="poll-summary-options">
                      {getPollOptionEntries(poll).map(({ letter, label }) => (
                        <div key={letter} className="poll-summary-option">
                          <span className="poll-summary-option-label">{label}</span>
                          <span className="poll-summary-option-value">
                            {formatVotePercentage(
                              letter === "A"
                                ? tally.countA
                                : letter === "B"
                                  ? tally.countB
                                  : letter === "C"
                                    ? tally.countC
                                    : letter === "D"
                                      ? tally.countD
                                      : tally.countE,
                              tally.totalConfirmed
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })
            ) : (
              <p className="muted-text">No public polls are available for this account.</p>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
