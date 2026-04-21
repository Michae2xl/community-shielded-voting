import Link from "next/link";
import { ZcashBrandmark } from "@/components/zcash-brandmark";

function mapErrorMessage(error: string | undefined) {
  switch (error) {
    case "invalid_input":
      return "Use a unique user ID, a valid email, and a password with at least 8 characters.";
    case "user_id_taken":
      return "That user ID is already taken.";
    case "email_taken":
      return "That email is already in use.";
    case "service_unavailable":
      return "Signup is temporarily unavailable until the database is configured.";
    case "forbidden_origin":
      return "This signup attempt came from an untrusted origin.";
    default:
      return null;
  }
}

export default async function SignupPage({
  searchParams
}: {
  searchParams?: Promise<{
    error?: string;
  }>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const errorMessage = mapErrorMessage(resolvedSearchParams.error);

  return (
    <main className="page-shell">
      <section className="auth-shell">
        <section className="hero-card auth-card">
          <div className="portal-body">
            <div className="eyebrow-row">
              <p className="eyebrow">Creator access</p>
              <ZcashBrandmark className="zcash-brandmark--compact" />
            </div>
            <h1 className="portal-subheading">Create your account</h1>
            <p className="lead">
              Start using shielded voting immediately. Your account will own only
              the polls you create.
            </p>
          </div>
          {errorMessage ? <p className="error-notice">{errorMessage}</p> : null}
          <form action="/api/auth/signup" method="post" className="portal-form">
            <div className="field">
              <label className="field-label" htmlFor="userId">
                User ID
              </label>
              <input
                id="userId"
                name="userId"
                autoComplete="username"
                placeholder="creator01"
                required
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
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
                autoComplete="new-password"
                placeholder="Choose a password"
                required
              />
            </div>
            <button type="submit">Create account</button>
          </form>
          <div className="portal-support">
            <div className="support-list">
              <div className="support-list-item">
                <strong>Immediate access</strong>
                <span>No email verification is required before creating your first poll.</span>
              </div>
              <div className="support-list-item">
                <strong>Owned by you</strong>
                <span>Your dashboard will show only the polls you create.</span>
              </div>
            </div>
            <div className="editorial-inline-actions">
              <Link href="/login" className="button-link">
                Sign in instead
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
