import { notFound } from "next/navigation";
import { readCollectorTally } from "@/lib/services/collector-tally";

export default async function CollectorLivePage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const tally = await readCollectorTally();

  return (
    <main className="page-shell">
      <section className="workspace-shell">
        <header className="hero-card workspace-header">
          <div className="workspace-header-copy">
            <p className="eyebrow">Collector live</p>
            <h1 className="workspace-title">Direct Zcash tally</h1>
            <p className="workspace-copy">
              This page reads confirmed memo receipts directly from the collector
              wallet and does not depend on the app database.
            </p>
          </div>
          <div className="meta-chip-row">
            <span className="meta-chip">Zallet collector</span>
            <span className="meta-chip">Memo tally</span>
            <span className="meta-chip meta-chip--mint">
              {tally.totalConfirmed} confirmed
            </span>
          </div>
        </header>

        <section className="hero-card form-panel">
          <div className="form-section-intro">
            <p className="section-label">Counts</p>
            <h2 className="form-section-title">Current result</h2>
          </div>
          <div className="metric-grid">
            <div className="metric-card">
              <span className="metric-card-label">A</span>
              <strong className="metric-card-value">{tally.counts.A}</strong>
            </div>
            <div className="metric-card">
              <span className="metric-card-label">B</span>
              <strong className="metric-card-value">{tally.counts.B}</strong>
            </div>
            <div className="metric-card">
              <span className="metric-card-label">C</span>
              <strong className="metric-card-value">{tally.counts.C}</strong>
            </div>
            <div className="metric-card">
              <span className="metric-card-label">D</span>
              <strong className="metric-card-value">{tally.counts.D}</strong>
            </div>
            <div className="metric-card">
              <span className="metric-card-label">E</span>
              <strong className="metric-card-value">{tally.counts.E}</strong>
            </div>
          </div>
        </section>

        <section className="hero-card form-panel">
          <div className="form-section-intro">
            <p className="section-label">Receipts</p>
            <h2 className="form-section-title">Collector-visible notes</h2>
            <p className="form-section-copy">
              Only memo values `A-E` are counted below.
            </p>
          </div>
          <div className="support-list">
            {tally.receipts.length === 0 ? (
              <p className="muted-text">No confirmed collector receipts yet.</p>
            ) : (
              tally.receipts.map((receipt) => (
                <div className="support-list-item" key={`${receipt.txid}:${receipt.optionLetter}`}>
                  <strong>
                    {receipt.optionLetter} · {receipt.amountZat} zats
                  </strong>
                  <span>
                    txid {receipt.txid} · address {receipt.shieldedAddress}
                    {receipt.blockHeight ? ` · height ${receipt.blockHeight}` : ""}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
