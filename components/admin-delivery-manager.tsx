"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type DeliveryRow = {
  id: string;
  nick: string;
  email: string;
  inviteStatus: string;
  statusTone: "neutral" | "success" | "warning";
  canSelect: boolean;
};

export function AdminDeliveryManager({
  pollId,
  rows
}: {
  pollId: string;
  rows: DeliveryRow[];
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const selectableRows = useMemo(() => rows.filter((row) => row.canSelect), [rows]);

  function toggleRow(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  }

  async function handleResend() {
    setIsSending(true);
    setError(null);
    setNotice(null);

    const response = await fetch(`/api/admin/polls/${pollId}/invites/send-selected`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ pollVoterAccessIds: selectedIds })
    });
    const json = (await response.json().catch(() => null)) as
      | { sent?: number; failed?: number; skippedMissingEmail?: number; error?: string }
      | null;

    if (!response.ok) {
      setError(json?.error ?? "Failed to resend invites");
      setIsSending(false);
      return;
    }

    setNotice(
      `Sent ${json?.sent ?? 0}, failed ${json?.failed ?? 0}, missing email ${json?.skippedMissingEmail ?? 0}.`
    );
    setSelectedIds([]);
    setIsSending(false);
    router.refresh();
  }

  return (
    <div className="editorial-stack">
      <section className="editorial-module">
        <div className="editorial-section-head">
          <div>
            <p className="section-label">Delivery</p>
            <h3>Select rows before resending</h3>
          </div>
          <button
            type="button"
            className="button-link button-link-primary"
            disabled={isSending || selectedIds.length === 0}
            onClick={() => void handleResend()}
          >
            {isSending ? "Resending..." : "Resend invites to selected"}
          </button>
        </div>
        <p className="muted-text">
          New voters added after opening stay pending until you select them here and
          resend the invite.
        </p>
        {notice ? <p className="muted-text">{notice}</p> : null}
        {error ? <p className="error-notice">{error}</p> : null}
      </section>

      <div className="editorial-table-wrap">
        <table className="editorial-table">
          <thead>
            <tr>
              <th className="editorial-table-check">Select</th>
              <th>Nick</th>
              <th>Email</th>
              <th>Invite status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="editorial-table-check">
                  {row.canSelect ? (
                    <input
                      type="checkbox"
                      aria-label={`Select ${row.nick}`}
                      checked={selectedIds.includes(row.id)}
                      onChange={() => toggleRow(row.id)}
                    />
                  ) : (
                    <span className="muted-text">-</span>
                  )}
                </td>
                <td>{row.nick}</td>
                <td>{row.email}</td>
                <td>
                  <span className={`status-pill status-pill--${row.statusTone}`}>
                    {row.inviteStatus}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!selectableRows.length ? (
        <p className="muted-text">No pending or failed rows need a resend right now.</p>
      ) : null}
    </div>
  );
}
