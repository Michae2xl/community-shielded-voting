import Link from "next/link";
import { AdminPollCreateForm } from "@/components/admin-poll-create-form";

export default function NewPollPage() {
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
                <p className="eyebrow">Create</p>
                <h1 className="editorial-title">Prepare the poll, then review before opening.</h1>
              </div>
              <span className="status-pill">New poll</span>
            </div>
            <p className="editorial-copy editorial-copy--wide">
              This first step is intentionally calm: define the question, add voters,
              and confirm the window. The blockchain and delivery work happen from the
              review screen through one guided action.
            </p>
            <div className="editorial-card-grid">
              <article className="editorial-note-card">
                <span className="section-label">Module 1</span>
                <strong>Question and answer rails</strong>
                <p>Visible labels stay human, while the collector still counts A-E.</p>
              </article>
              <article className="editorial-note-card">
                <span className="section-label">Module 2</span>
                <strong>Voter table</strong>
                <p>Start line by line, then use bulk paste only when it actually saves time.</p>
              </article>
              <article className="editorial-note-card">
                <span className="section-label">Module 3</span>
                <strong>Guided opening</strong>
                <p>The next screen runs anchor, tickets, invites, and open status in sequence.</p>
              </article>
            </div>
          </section>

          <AdminPollCreateForm />
        </div>
      </section>
    </main>
  );
}
