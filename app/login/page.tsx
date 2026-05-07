import Link from "next/link";
import { ZcashBrandmark } from "@/components/zcash-brandmark";

function mapErrorMessage(error: string | undefined) {
  if (error === "1") {
    return "Login failed. Check your user ID and password, or reopen your one-time invite link.";
  }

  if (error === "service_unavailable") {
    return "Login is temporarily unavailable until the database is configured.";
  }

  if (error === "forbidden_origin") {
    return "This login attempt came from an untrusted origin.";
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
            <div className="eyebrow-row">
              <p className="eyebrow">Portal access</p>
              <ZcashBrandmark className="zcash-brandmark--compact" />
            </div>
            <h1 className="portal-subheading">Sign in</h1>
            <p className="lead">
              Use your admin credentials to enter the portal. Voters should open
              their one-time invite link instead of typing a password.
            </p>
          </div>
          {errorMessage ? <p className="error-notice">{errorMessage}</p> : null}
          <form action="/api/auth/login" method="post" className="portal-form">
            <input type="hidden" name="next" value={next} />
            <div className="field">
              <label className="field-label" htmlFor="userId">
                User ID
              </label>
              <input
                id="userId"
                name="userId"
                autoComplete="username"
                placeholder="creator01 or invite user"
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
                <strong>Creator access</strong>
                <span>Create polls, manage voters, and operate your own shielded voting workflow.</span>
              </div>
              <div className="support-list-item">
                <strong>Voter access</strong>
                <span>Open your eligible polls and scan the pre-built ZIP-321 request.</span>
              </div>
            </div>
            <div className="editorial-inline-actions">
              <Link href="/signup" className="button-link">
                Create account
              </Link>
              <Link href="/" className="button-link">
                Return to overview
              </Link>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
