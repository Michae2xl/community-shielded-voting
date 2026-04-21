"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";

type DraftVoterRow = {
  id: string;
  nick: string;
  email: string;
};

type PreparedVoters = {
  payload: string;
  completeCount: number;
  partialRowNumbers: number[];
};

function generateRowId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `row_${Math.random().toString(36).slice(2, 10)}`;
}

function createRow(): DraftVoterRow {
  return {
    id: generateRowId(),
    nick: "",
    email: ""
  };
}

function toIsoDateTime(value: string) {
  if (!value) {
    return "";
  }

  const [datePart, timePart] = value.split("T");
  if (!datePart || !timePart) {
    return "";
  }

  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  if (
    [year, month, day, hour, minute].some((part) => Number.isNaN(part)) ||
    !year ||
    !month ||
    !day
  ) {
    return "";
  }

  return new Date(year, month - 1, day, hour, minute).toISOString();
}

function prepareVoters(rows: DraftVoterRow[]): PreparedVoters {
  const completeRows: string[] = [];
  const partialRowNumbers: number[] = [];

  rows.forEach((row, index) => {
    const nick = row.nick.trim();
    const email = row.email.trim().toLowerCase();

    if (!nick && !email) {
      return;
    }

    if (!nick || !email) {
      partialRowNumbers.push(index + 1);
      return;
    }

    completeRows.push(`${nick},${email}`);
  });

  return {
    payload: completeRows.join("\n"),
    completeCount: completeRows.length,
    partialRowNumbers
  };
}

function parseBulkVoters(input: string) {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [nick = "", email = ""] = line.split(",").map((value) => value.trim());

      return {
        id: generateRowId(),
        nick,
        email
      };
    });
}

export function AdminPollCreateForm() {
  const router = useRouter();
  const [opensAtLocal, setOpensAtLocal] = useState("");
  const [closesAtLocal, setClosesAtLocal] = useState("");
  const [rows, setRows] = useState<DraftVoterRow[]>([createRow()]);
  const [bulkInput, setBulkInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const preparedVoters = useMemo(() => prepareVoters(rows), [rows]);

  function updateRow(id: string, field: "nick" | "email", value: string) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  }

  function addRow() {
    setRows((current) => [...current, createRow()]);
  }

  function removeRow(id: string) {
    setRows((current) =>
      current.length === 1 ? current : current.filter((row) => row.id !== id)
    );
  }

  function applyBulkInput() {
    const parsed = parseBulkVoters(bulkInput);

    if (!parsed.length) {
      return;
    }

    setRows(parsed);
    setBulkInput("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (preparedVoters.partialRowNumbers.length) {
      setError(
        `Complete both nick and email for voter row${preparedVoters.partialRowNumbers.length === 1 ? "" : "s"} ${preparedVoters.partialRowNumbers.join(", ")}.`
      );
      return;
    }

    if (preparedVoters.completeCount === 0) {
      setError("Add at least one voter with both nick and email.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    formData.set("voters", preparedVoters.payload);
    const response = await fetch("/api/admin/polls", {
      method: "POST",
      body: formData
    });
    const json = (await response.json().catch(() => null)) as
      | {
          pollId?: string;
          error?: string;
          details?: { issues?: Array<{ message?: string }> };
        }
      | null;

    if (!response.ok || !json?.pollId) {
      setError(
        json?.details?.issues?.[0]?.message ?? json?.error ?? "Failed to create poll"
      );
      return;
    }

    startTransition(() => {
      router.push(`/admin/polls/${json.pollId}`);
    });
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="hero-card editorial-panel editorial-panel--form"
      autoComplete="off"
    >
      <div className="editorial-section-head">
        <div>
          <p className="eyebrow">Create poll</p>
          <h2 className="editorial-title editorial-title--compact">Draft the review screen.</h2>
        </div>
        <span className="status-pill">Review first</span>
      </div>
      <p className="editorial-copy editorial-copy--wide">
        Set the question, visible answers, voter table, and window. After this, the
        admin lands on a review dashboard with a single primary action: open the poll.
      </p>

      <section className="editorial-module">
        <div className="editorial-module-head">
          <p className="section-label">Question</p>
          <h3>What is being decided?</h3>
        </div>
        <label className="field" htmlFor="question">
          <span className="field-label">Question</span>
          <textarea
            id="question"
            name="question"
            className="field-control--question"
            placeholder="Which treasury policy should be activated for the next period?"
            required
            minLength={12}
          />
        </label>
      </section>

      <section className="editorial-module">
        <div className="editorial-module-head">
          <p className="section-label">Answers</p>
          <h3>Visible labels for rails A-E</h3>
        </div>
        <div className="editorial-option-grid">
          <label className="field">
            <span className="field-label">A label</span>
            <input id="optionALabel" name="optionALabel" placeholder="Approve" required />
          </label>
          <label className="field">
            <span className="field-label">B label</span>
            <input id="optionBLabel" name="optionBLabel" placeholder="Reject" required />
          </label>
          <label className="field">
            <span className="field-label">C label</span>
            <input id="optionCLabel" name="optionCLabel" placeholder="Optional" />
          </label>
          <label className="field">
            <span className="field-label">D label</span>
            <input id="optionDLabel" name="optionDLabel" placeholder="Optional" />
          </label>
          <label className="field">
            <span className="field-label">E label</span>
            <input id="optionELabel" name="optionELabel" placeholder="Optional" />
          </label>
        </div>
      </section>

      <section className="editorial-module">
        <div className="editorial-module-head">
          <p className="section-label">Voters</p>
          <h3>Build the initial delivery list</h3>
        </div>
        <p className="field-hint">
          Required: at least one complete voter row. Blank rows are ignored.
        </p>
        <div className="editorial-table-wrap">
          <table className="editorial-table">
            <thead>
              <tr>
                <th>Nick</th>
                <th>Email</th>
                <th className="editorial-table-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id}>
                  <td>
                    <input
                      name={`voter-nick-${row.id}`}
                      aria-label={`Voter nick ${index + 1}`}
                      value={row.nick}
                      onChange={(event) =>
                        updateRow(row.id, "nick", event.currentTarget.value)
                      }
                      placeholder="voter01"
                      autoComplete="off"
                      data-lpignore="true"
                      data-1p-ignore="true"
                    />
                  </td>
                  <td>
                    <input
                      name={`voter-email-${row.id}`}
                      aria-label={`Voter email ${index + 1}`}
                      value={row.email}
                      onChange={(event) =>
                        updateRow(row.id, "email", event.currentTarget.value)
                      }
                      placeholder="voter@example.com"
                      type="email"
                      autoComplete="off"
                      data-lpignore="true"
                      data-1p-ignore="true"
                    />
                  </td>
                  <td className="editorial-table-actions">
                    <button
                      type="button"
                      className="secondary-button editorial-inline-button"
                      onClick={() => removeRow(row.id)}
                      disabled={rows.length === 1}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="editorial-inline-actions">
          <button type="button" className="secondary-button" onClick={addRow}>
            Add voter
          </button>
        </div>
        <details className="editorial-disclosure">
          <summary>Paste list in bulk</summary>
          <div className="editorial-disclosure-body">
            <textarea
              value={bulkInput}
              onChange={(event) => setBulkInput(event.currentTarget.value)}
              placeholder={"voter01,voter01@example.com\nvoter02,voter02@example.com"}
              autoComplete="off"
              data-lpignore="true"
              data-1p-ignore="true"
            />
            <div className="editorial-inline-actions">
              <button type="button" className="secondary-button" onClick={applyBulkInput}>
                Replace table rows
              </button>
            </div>
          </div>
        </details>
        <input type="hidden" name="voters" value={preparedVoters.payload} readOnly />
      </section>

      <section className="editorial-module">
        <div className="editorial-module-head">
          <p className="section-label">Window</p>
          <h3>When should the poll run?</h3>
        </div>
        <div className="editorial-option-grid editorial-option-grid--window">
          <label className="field">
            <span className="field-label">Opens at</span>
            <input
              id="opensAtLocal"
              name="opensAtLocal"
              type="datetime-local"
              value={opensAtLocal}
              onChange={(event) => setOpensAtLocal(event.currentTarget.value)}
              required
            />
            <input type="hidden" name="opensAt" value={toIsoDateTime(opensAtLocal)} />
          </label>
          <label className="field">
            <span className="field-label">Closes at</span>
            <input
              id="closesAtLocal"
              name="closesAtLocal"
              type="datetime-local"
              value={closesAtLocal}
              onChange={(event) => setClosesAtLocal(event.currentTarget.value)}
              required
            />
            <input type="hidden" name="closesAt" value={toIsoDateTime(closesAtLocal)} />
          </label>
        </div>
      </section>

      <div className="portal-support">
        <button type="submit" disabled={isPending}>
          {isPending ? "Creating draft..." : "Create review draft"}
        </button>
        {error ? <p className="error-notice">{error}</p> : null}
        <p className="admin-submit-copy">
          After the draft is created, the admin lands on the poll review dashboard
          where opening the poll runs the rest of the sequence.
        </p>
      </div>
    </form>
  );
}
