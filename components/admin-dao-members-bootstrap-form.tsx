"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminDaoMembersBootstrapForm() {
  const router = useRouter();
  const [members, setMembers] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setIsSaving(true);
    setError(null);

    const response = await fetch("/api/admin/dao-members/bootstrap", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ members })
    });
    const json = (await response.json().catch(() => null)) as
      | { error?: string; details?: { issues?: Array<{ message?: string }> } }
      | null;

    setIsSaving(false);

    if (!response.ok) {
      setError(
        json?.details?.issues?.[0]?.message ??
          json?.error ??
          "Failed to initialize DAO members"
      );
      return;
    }

    setMembers("");
    router.refresh();
  }

  return (
    <section className="editorial-module">
      <div className="editorial-module-head">
        <p className="section-label">Bootstrap</p>
        <h3>Create the initial Zechub DAO member basket</h3>
      </div>
      <p className="field-hint">
        This direct setup is available only while the basket is empty. After it is
        initialized, additions and removals must pass through governance polls.
      </p>
      <textarea
        value={members}
        onChange={(event) => setMembers(event.currentTarget.value)}
        placeholder={"michae2xl,michae2xl.42\nalice,alice_user.99"}
      />
      <div className="editorial-inline-actions">
        <button
          type="button"
          className="button-link button-link-primary"
          disabled={isSaving || !members.trim()}
          onClick={() => void handleSubmit()}
        >
          {isSaving ? "Creating..." : "Create initial basket"}
        </button>
      </div>
      {error ? <p className="error-notice">{error}</p> : null}
    </section>
  );
}
