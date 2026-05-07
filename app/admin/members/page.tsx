import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminDaoMembersBootstrapForm } from "@/components/admin-dao-members-bootstrap-form";
import { ZcashBrandmark } from "@/components/zcash-brandmark";
import { canManagePolls } from "@/lib/auth/guards";
import { readSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

function presentStatus(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export default async function AdminMembersPage() {
  const session = await readSession();

  if (!session) {
    redirect("/login?next=%2Fadmin%2Fmembers");
  }

  if (!canManagePolls(session.role)) {
    redirect("/polls");
  }

  const members = await db.daoMember.findMany({
    orderBy: [{ status: "asc" }, { nick: "asc" }],
    select: {
      id: true,
      nick: true,
      signalUsername: true,
      status: true,
      addedByPollId: true,
      removedByPollId: true,
      createdAt: true,
      updatedAt: true
    }
  });
  const activeCount = members.filter((member) => member.status === "ACTIVE").length;

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
                <p className="eyebrow">DAO members</p>
                <ZcashBrandmark className="zcash-brandmark--compact" />
              </div>
              <h1 className="editorial-title">Zechub DAO voter basket.</h1>
            </div>
            <div className="editorial-inline-actions">
              <span className="status-pill">{activeCount} active</span>
              <span className="status-pill">{members.length} total</span>
            </div>
          </div>
          <p className="editorial-copy editorial-copy--wide">
            This basket is the fixed Signal username roster used for Zechub DAO
            polls. Direct setup is allowed only once. After that, adding or removing
            a member must happen through a poll and only applies if the proposal passes.
          </p>
          {members.length ? (
            <div className="editorial-card-grid">
              <article className="editorial-note-card">
                <span className="section-label">Creation</span>
                <strong>Polls target the active basket</strong>
                <p>New DAO polls copy active members into their own access list.</p>
              </article>
              <article className="editorial-note-card">
                <span className="section-label">Change control</span>
                <strong>No direct admin edits</strong>
                <p>Use membership proposals for future adds or removals.</p>
              </article>
              <article className="editorial-note-card">
                <span className="section-label">Delivery</span>
                <strong>Signal username only</strong>
                <p>No phone numbers and no email credentials in the member basket.</p>
              </article>
            </div>
          ) : null}
        </header>

        <section className="hero-card editorial-panel editorial-panel--wide">
          {members.length === 0 ? (
            <AdminDaoMembersBootstrapForm />
          ) : (
            <>
              <div className="editorial-section-head">
                <div>
                  <p className="section-label">Roster</p>
                  <h2 className="editorial-title editorial-title--compact">
                    Governed after initialization.
                  </h2>
                </div>
                <Link href="/admin/polls/new" className="button-link button-link-primary">
                  Create proposal
                </Link>
              </div>
              <p className="field-hint">
                This table is read-only. To add a member, create an “Add DAO member”
                proposal. To remove a member, create a “Remove DAO member” proposal.
              </p>
              <div className="editorial-table-wrap">
                <table className="editorial-table">
                  <thead>
                    <tr>
                      <th>Nick</th>
                      <th>Signal username</th>
                      <th>Status</th>
                      <th>Governance source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <tr key={member.id}>
                        <td>{member.nick}</td>
                        <td>{member.signalUsername}</td>
                        <td>
                          <span
                            className={
                              member.status === "ACTIVE"
                                ? "status-pill status-pill--success"
                                : "status-pill"
                            }
                          >
                            {presentStatus(member.status)}
                          </span>
                        </td>
                        <td>
                          {member.removedByPollId ? (
                            <Link
                              href={`/admin/polls/${member.removedByPollId}`}
                              className="text-link"
                            >
                              Removed by poll
                            </Link>
                          ) : member.addedByPollId ? (
                            <Link
                              href={`/admin/polls/${member.addedByPollId}`}
                              className="text-link"
                            >
                              Added by poll
                            </Link>
                          ) : (
                            <span className="muted-text">Initial basket</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </section>
    </main>
  );
}
