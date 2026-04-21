import Link from "next/link";

function mapErrorMessage(error: string | undefined) {
  if (error === "1") {
    return "Login failed. Check your nick and password.";
  }

  if (error === "service_unavailable") {
    return "Login is temporarily unavailable until the database is configured.";
  }

  return null;
}

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<{
    error?: string;
    next?: string;
  }>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const next = resolvedSearchParams.next ?? "";
  const errorMessage = mapErrorMessage(resolvedSearchParams.error);

  return (
    <main className="page-shell">
      <section className="auth-shell">
        <section className="hero-card auth-card">
          <div className="portal-body">
            <p className="eyebrow">Portal access</p>
            <h1 className="portal-subheading">Sign in</h1>
            <p className="lead">
              Use your admin credentials or the temporary voter credentials from
              your invite email to enter the portal.
            </p>
          </div>
          {errorMessage ? <p className="error-notice">{errorMessage}</p> : null}
          <form action="/api/auth/login" method="post" className="portal-form">
            <input type="hidden" name="next" value={next} />
            <div className="field">
              <label className="field-label" htmlFor="nick">
                Nick
              </label>
              <input
                id="nick"
                name="nick"
                autoComplete="username"
                placeholder="admin or alice"
                required
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                required
              />
            </div>
            <button type="submit">Enter portal</button>
          </form>
          <div className="portal-support">
            <div className="support-list">
              <div className="support-list-item">
                <strong>Admin access</strong>
                <span>Create polls, issue tickets, anchor receipts, and review tally APIs.</span>
              </div>
              <div className="support-list-item">
                <strong>Voter access</strong>
                <span>Open your eligible polls and scan the pre-built ZIP-321 request.</span>
              </div>
            </div>
            <Link href="/" className="button-link">
              Return to overview
            </Link>
          </div>
        </section>
      </section>
    </main>
  );
}
