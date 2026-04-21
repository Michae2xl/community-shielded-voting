import Link from "next/link";
import React from "react";

export function HomePage() {
  return (
    <main className="page-shell">
      <section className="portal-shell">
        <div className="portal-focus">
          <section className="hero-card portal-panel portal-panel--home">
            <div className="portal-topline">
              <p className="eyebrow">Shielded voting</p>
              <span className="status-chip">Portal access</span>
            </div>
            <div className="portal-body">
              <h1 className="portal-subheading">Sign in to continue</h1>
              <p className="lead">
                Access live polls, voting QR requests, and the shielded admin
                workflow from one entry point.
              </p>
            </div>
            <div className="portal-actions">
              <Link href="/login" className="button-link button-link-primary">
                Sign in
              </Link>
              <Link href="/polls" className="button-link button-link-secondary">
                View polls
              </Link>
            </div>
            <div className="portal-support">
              <div className="support-list">
                <div className="support-list-item">
                  <strong>Public board</strong>
                  <span>Open polls stay visible with reconciled percentages and poll IDs.</span>
                </div>
                <div className="support-list-item">
                  <strong>Invite-based voting</strong>
                  <span>Direct voting remains restricted to the invite link and signed-in poll flow.</span>
                </div>
                <div className="support-list-item">
                  <strong>Receipt delivery</strong>
                  <span>Confirmed vote receipts are sent only to the voter after on-chain confirmation.</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

export default HomePage;
