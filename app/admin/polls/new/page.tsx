import Link from "next/link";
import { DaoMemberStatus } from "@prisma/client";
import { AdminPollCreateForm } from "@/components/admin-poll-create-form";
import { ZcashBrandmark } from "@/components/zcash-brandmark";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NewPollPage() {
  const daoMembers = await db.daoMember.findMany({
    where: {
      status: DaoMemberStatus.ACTIVE
    },
    orderBy: {
      nick: "asc"
    },
    select: {
      id: true,
      nick: true,
      signalUsername: true
    }
  });

  return (
    <main className="page-shell">
      <section className="workspace-shell">
        <Link href="/admin/polls" className="admin-back-link">
          <span aria-hidden="true">←</span>
          <span>Polls</span>
        </Link>

        <div className="editorial-grid editorial-grid--admin">
          <section className="hero-card editorial-panel editorial-panel--wide">
            <div className="editorial-section-head">
              <div>
                <div className="eyebrow-row">
                  <p className="eyebrow">Create</p>
                  <ZcashBrandmark className="zcash-brandmark--compact" />
                </div>
                <h1 className="editorial-title">Prepare the poll, then review before opening.</h1>
              </div>
              <span className="status-pill">New poll</span>
            </div>
            <p className="editorial-copy editorial-copy--wide">
              This first step is intentionally calm: define the question, select
              the governance path, and confirm the window. The blockchain and
              Signal delivery work happen from the review screen through one
              guided action.
            </p>
            <div className="editorial-card-grid">
              <article className="editorial-note-card">
                <span className="section-label">Module 1</span>
                <strong>Question and answer rails</strong>
                <p>Visible labels stay human, while the collector still counts A-E.</p>
              </article>
              <article className="editorial-note-card">
                <span className="section-label">Module 2</span>
                <strong>DAO member basket</strong>
                <p>Once initialized, every poll targets the active Signal roster.</p>
              </article>
              <article className="editorial-note-card">
                <span className="section-label">Module 3</span>
                <strong>Guided opening</strong>
                <p>The next screen runs anchor, tickets, invites, and open status in sequence.</p>
              </article>
            </div>
          </section>

          <AdminPollCreateForm daoMembers={daoMembers} />
        </div>
      </section>
    </main>
  );
}
