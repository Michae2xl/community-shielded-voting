"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type VoterRow = {
  id: string;
  nick: string;
  email: string;
  inviteStatus: string;
  statusTone: "neutral" | "success" | "warning";
  canRemove: boolean;
};

function parseBulkVoters(input: string) {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [nick = "", email = ""] = line.split(",").map((value) => value.trim());

      return { nick, email };
    });
}

export function AdminVotersManager({
  pollId,
  rows
}: {
  pollId: string;
  rows: VoterRow[];
}) {
  const router = useRouter();
  const [nick, setNick] = useState("");
  const [email, setEmail] = useState("");
  const [bulkInput, setBulkInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const parsedBulk = useMemo(() => parseBulkVoters(bulkInput), [bulkInput]);

  async function createVoters(voters: Array<{ nick: string; email: string }>) {
    if (!voters.length) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setNotice(null);

    const response = await fetch(`/api/admin/polls/${pollId}/voters`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ voters })
    });
    const json = (await response.json().catch(() => null)) as
      | { created?: Array<{ id: string }>; error?: string }
      | null;

    if (!response.ok) {
      setError(json?.error ?? "Failed to add voters");
      setIsSaving(false);
      return;
    }

    setNick("");
    setEmail("");
    setBulkInput("");
    setNotice(`${json?.created?.length ?? voters.length} voter(s) added.`);
    setIsSaving(false);
    router.refresh();
  }

  async function handleRemove(accessId: string) {
    setError(null);
    setNotice(null);

    const response = await fetch(`/api/admin/polls/${pollId}/voters/${accessId}`, {
      method: "DELETE"
    });
    const json = (await response.json().catch(() => null)) as
      | { ok?: boolean; error?: string }
      | null;

    if (!response.ok) {
      setError(json?.error ?? "Failed to remove voter");
      return;
    }

    setNotice("Voter removed.");
    router.refresh();
  }

  return (
    <div className="editorial-stack">
      <section className="editorial-module">
        <div className="editorial-module-head">
          <p className="section-label">Add voter</p>
          <h3>Keep the delivery list editable</h3>
        </div>
        <div className="editorial-inline-form">
          <input
            aria-label="Nick"
            value={nick}
            onChange={(event) => setNick(event.currentTarget.value)}
            placeholder="nick"
          />
          <input
            aria-label="Email"
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
            placeholder="email@example.com"
            type="email"
          />
          <button
            type="button"
            className="button-link button-link-primary"
            disabled={isSaving || !nick.trim() || !email.trim()}
            onClick={() => void createVoters([{ nick, email }])}
          >
            {isSaving ? "Adding..." : "Add voter"}
          </button>
        </div>
        <details className="editorial-disclosure">
          <summary>Paste list in bulk</summary>
          <div className="editorial-disclosure-body">
            <textarea
              value={bulkInput}
              onChange={(event) => setBulkInput(event.currentTarget.value)}
              placeholder={"michae2xl,michaelguima@proton.me\nalice,alice@example.com"}
            />
            <div className="editorial-inline-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={isSaving || !parsedBulk.length}
                onClick={() => void createVoters(parsedBulk)}
              >
                {isSaving ? "Adding..." : "Add pasted voters"}
              </button>
            </div>
          </div>
        </details>
        {notice ? <p className="muted-text">{notice}</p> : null}
        {error ? <p className="error-notice">{error}</p> : null}
      </section>

      <div className="editorial-table-wrap">
        <table className="editorial-table">
          <thead>
            <tr>
              <th>Nick</th>
              <th>Email</th>
              <th>Invite status</th>
              <th className="editorial-table-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.nick}</td>
                <td>{row.email}</td>
                <td>
                  <span className={`status-pill status-pill--${row.statusTone}`}>
                    {row.inviteStatus}
                  </span>
                </td>
                <td className="editorial-table-actions">
                  {row.canRemove ? (
                    <button
                      type="button"
                      className="secondary-button editorial-inline-button"
                      onClick={() => void handleRemove(row.id)}
                    >
                      Remove
                    </button>
                  ) : (
                    <span className="muted-text">Kept for audit</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
