import Link from "next/link";
import { redirect } from "next/navigation";
import { canManagePolls } from "@/lib/auth/guards";
import { readSession } from "@/lib/auth/session";
import { ZcashBrandmark } from "@/components/zcash-brandmark";
import { db } from "@/lib/db";

function formatDateTime(value: Date) {
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

export default async function AdminPollDirectoryPage() {
  const session = await readSession();

  if (!session) {
    redirect("/login?next=%2Fadmin%2Fpolls");
  }

  if (!canManagePolls(session.role)) {
    redirect("/polls");
  }

  const polls = await db.poll.findMany({
    where: {
      createdById: session.userId
    },
    orderBy: {
      createdAt: "desc"
    },
    select: {
      id: true,
      question: true,
      status: true,
      opensAt: true,
      closesAt: true,
      tally: {
        select: {
          totalConfirmed: true
        }
      },
      voterAccesses: {
        select: {
          id: true,
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

        <header className="hero-card editorial-panel editorial-panel--wide">
          <div className="editorial-section-head">
            <div>
              <div className="eyebrow-row">
                <p className="eyebrow">Admin</p>
                <ZcashBrandmark className="zcash-brandmark--compact" />
              </div>
              <h1 className="editorial-title">Polls</h1>
            </div>
            <div className="editorial-inline-actions">
              <span className="status-pill">Polls</span>
              <Link href="/admin/polls/new" className="button-link button-link-primary">
                Create poll
              </Link>
            </div>
          </div>
          <p className="editorial-copy editorial-copy--wide">
            Review only the polls you created, jump into the dashboard, and track
            how many voters completed the flow without opening the audit-heavy
            surface first. Total polls: {polls.length}.
          </p>
        </header>

        <section className="hero-card editorial-panel editorial-panel--wide">
          <div className="editorial-section-head">
            <div>
              <p className="section-label">Recent polls</p>
              <h2 className="editorial-title editorial-title--compact">
                Scan the state before you go deeper.
              </h2>
            </div>
          </div>

          <div className="admin-directory-list">
            {polls.map((poll) => {
              const completedVoters = poll.voterAccesses.filter((access) =>
                access.assignments.some(
                  (assignment) => assignment.ticket.status === "VOTED"
                )
              ).length;

              return (
                <Link
                  key={poll.id}
                  href={`/admin/polls/${poll.id}`}
                  className="admin-directory-row"
                >
                  <div className="admin-directory-row-main">
                    <div className="admin-directory-row-copy">
                      <span className="section-label">Poll {poll.id}</span>
                      <strong>{poll.question}</strong>
                    </div>
                    <span className="status-pill">{presentStatus(poll.status)}</span>
                  </div>
                  <div className="admin-directory-row-meta">
                    <div>
                      <span className="section-label">Opens</span>
                      <strong>{formatDateTime(poll.opensAt)}</strong>
                    </div>
                    <div>
                      <span className="section-label">Closes</span>
                      <strong>{formatDateTime(poll.closesAt)}</strong>
                    </div>
                    <div>
                      <span className="section-label">Completed voters</span>
                      <strong>
                        {completedVoters}/{poll.voterAccesses.length}
                      </strong>
                    </div>
                    <div>
                      <span className="section-label">Reconciled result</span>
                      <strong>{poll.tally?.totalConfirmed ?? 0} valid vote(s)</strong>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}
