import Link from "next/link";
import { MarkdownInline } from "@/components/markdown-text";
import { readSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getPollOptionEntries } from "@/lib/domain/options";

function formatVoteCount(totalConfirmed: number) {
  return `${totalConfirmed} valid vote${totalConfirmed === 1 ? "" : "s"}`;
}

function formatVotePercentage(count: number, totalConfirmed: number) {
  if (totalConfirmed === 0) {
    return "0%";
  }

  return `${Math.round((count / totalConfirmed) * 100)}%`;
}

export default async function PollsPage() {
  const session = await readSession();

  const polls = await db.poll.findMany({
    where: {
      status: "OPEN" as const
    },
    orderBy: {
      createdAt: "desc"
    },
    select: {
      id: true,
      question: true,
      status: true,
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
      }
    }
  });

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
            <h1 className="workspace-title">Open polls</h1>
            <p className="workspace-copy">
              This board stays public and read-only. It shows each OPEN poll with its
              question, poll ID, and reconciled percentage split, while direct voting
              still happens only through the invite link or a signed-in poll URL.
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
            <span className="meta-chip meta-chip--mint">{polls.length} OPEN</span>
          </div>
        </header>

        <section className="hero-card form-panel">
          <div className="form-section-intro">
            <p className="section-label">Poll directory</p>
            <h2 className="form-section-title">Eligible polls</h2>
            <p className="form-section-copy">
              Each OPEN poll shows only the validated public result, with duplicate
              protection already applied before the percentages are rendered.
            </p>
          </div>
          <div className="stack">
            {polls.length ? (
              polls.map((poll) => {
                const tally = poll.tally ?? {
                  totalConfirmed: 0,
                  countA: 0,
                  countB: 0,
                  countC: 0,
                  countD: 0,
                  countE: 0
                };

                return (
                  <article key={poll.id} className="poll-summary-card">
                    <div className="poll-summary-head">
                      <div className="poll-summary-copy">
                        <p className="section-label">Live poll</p>
                        <strong>
                          <MarkdownInline value={poll.question} />
                        </strong>
                        <span className="muted-text">Poll ID: {poll.id}</span>
                      </div>
                      <span className="meta-chip meta-chip--mint">{poll.status}</span>
                    </div>
                    <p className="poll-summary-total">
                      {formatVoteCount(tally.totalConfirmed)}
                    </p>
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
              <p className="muted-text">No OPEN polls are available for this account.</p>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
