import Link from "next/link";
import {
  fillPublicAuditFeed,
  readPublicAuditFeed,
  type PublicAuditEvent
} from "@/lib/services/public-audit";
import { ZcashBrandmark } from "@/components/zcash-brandmark";

export const dynamic = "force-dynamic";

function formatAuditTime(timestamp: string, isLive?: boolean, isSample?: boolean) {
  if (isSample) {
    return "Example";
  }

  if (isLive) {
    return "Live";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC"
  }).format(new Date(timestamp));
}

export function HomePageContent({
  events,
  allowSampleFallback = false
}: {
  events: PublicAuditEvent[];
  allowSampleFallback?: boolean;
}) {
  const visibleEvents = fillPublicAuditFeed(events, 9, 3, allowSampleFallback);

  return (
    <main className="page-shell">
      <section className="home-shell">
        <section className="home-panel home-panel--access">
          <div className="portal-topline">
            <p className="eyebrow home-eyebrow">Shielded voting</p>
            <span className="home-chip">Portal access</span>
          </div>
          <div className="portal-body">
            <h1 className="home-title">Sign in to continue</h1>
            <p className="home-copy">
              Create a poll, manage voters, or enter a poll invitation. Public
              poll results remain visible without logging in.
            </p>
          </div>
          <div className="home-actions">
            <Link href="/login" className="button-link button-link-primary">
              Sign in
            </Link>
            <Link href="/polls" className="button-link home-button-secondary">
              View polls
            </Link>
          </div>
          <div className="home-access-visual" aria-hidden="true">
            <img
              src="/art/home-shielded-voting-hero-clear.svg"
              alt=""
              className="home-access-visual-image"
            />
          </div>
        </section>

        <section className="home-panel home-panel--audit">
          <div className="portal-body">
            <div className="home-audit-topline">
              <p className="eyebrow home-eyebrow">Public audit</p>
              <ZcashBrandmark label="Zcash rail" className="zcash-brandmark--compact" />
            </div>
            <h2 className="home-audit-title">Watch the shielded rail move</h2>
            <p className="home-audit-copy">
              Global feed of poll anchors, observed vote payments, and
              one-block confirmed votes from the system rail.
            </p>
          </div>
          <div className="home-audit-feed">
            {visibleEvents.map((event) => (
              <article key={event.id} className="home-audit-item">
                <div className="home-audit-head">
                  <span className={`home-audit-tag home-audit-tag--${event.type}`}>
                    {event.type === "poll_created"
                      ? "Poll created"
                      : event.type === "vote_observed"
                        ? "Vote observed"
                        : "Vote confirmed"}
                  </span>
                  <span className="home-audit-time">
                    {formatAuditTime(event.timestamp, event.isLive, event.isSample)}
                  </span>
                </div>
                <strong className="home-audit-poll">Poll {event.pollId}</strong>
                <p className="home-audit-summary">{event.summary}</p>
                {event.txid ? <code className="home-audit-txid">{event.txid}</code> : null}
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

export default async function HomePage() {
  const events = await readPublicAuditFeed().catch(() => []);

  return (
    <HomePageContent
      events={events}
      allowSampleFallback={process.env.NODE_ENV !== "production"}
    />
  );
}
