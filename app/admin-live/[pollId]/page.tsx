import { notFound } from "next/navigation";
import Link from "next/link";
import { MarkdownText } from "@/components/markdown-text";
import { OPTION_LETTERS } from "@/lib/domain/options";
import { readCollectorTally } from "@/lib/services/collector-tally";
import { getLocalAdminFallbackPoll } from "@/lib/local-admin-fallback";

function MetricCard({
  label,
  value
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="metric-card">
      <span className="metric-card-label">{label}</span>
      <strong className="metric-card-value">{value}</strong>
    </div>
  );
}

export default async function AdminLiveFallbackPage({
  params
}: {
  params: Promise<{ pollId: string }>;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const { pollId } = await params;
  const poll = getLocalAdminFallbackPoll(pollId);
  const tally = await readCollectorTally();

  return (
    <main className="page-shell">
      <section className="portal-shell">
        <div className="admin-dashboard-grid">
          <section className="hero-card form-panel admin-primary-panel">
            <div className="portal-body">
              <p className="eyebrow">Admin fallback</p>
              <MarkdownText
                value={poll.question}
                className="portal-subheading"
                headingLevel={1}
              />
              <p className="lead">
                Poll {poll.pollId} · {poll.status}. Local validation only, with the
                collector read directly and no database in the path.
              </p>
            </div>
            <div className="admin-status-row">
              <MetricCard label="Collector confirmed" value={tally.totalConfirmed} />
              <MetricCard label="Mode" value="Collector only" />
              <MetricCard label="Surface" value="No DB" />
            </div>
            <div className="portal-support">
              <Link href="/collector-live" className="button-link button-link-secondary">
                Open collector page
              </Link>
              <Link href="/api/collector/live-tally" className="button-link">
                Open collector API
              </Link>
            </div>
          </section>

          <section className="hero-card form-panel admin-side-panel">
            <div className="form-section-intro">
              <p className="section-label">Live result</p>
              <h2 className="form-section-title">Direct wallet tally</h2>
              <p className="form-section-copy">
                Validation-only read from the collector wallet.
              </p>
            </div>
            <div className="metric-grid">
              {OPTION_LETTERS.map((letter) => (
                <MetricCard
                  key={letter}
                  label={`${letter} · ${poll.optionLabels[letter]}`}
                  value={tally.counts[letter]}
                />
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
