"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import {
  formatOfficialPollDateTime,
  MIN_POLL_WINDOW_HOURS
} from "@/lib/domain/poll-window";
import {
  DEFAULT_PASSING_THRESHOLD_PERCENT,
  DEFAULT_QUORUM_PERCENT
} from "@/lib/domain/governance";

type DraftVoterRow = {
  id: string;
  nick: string;
  signalUsername: string;
};

type PreparedVoters = {
  payload: string;
  completeCount: number;
  partialRowNumbers: number[];
};

type DaoMemberOption = {
  id: string;
  nick: string;
  signalUsername: string;
};

type ProposalType = "STANDARD" | "ADD_MEMBER" | "REMOVE_MEMBER";

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
    signalUsername: ""
  };
}

function toUtcIsoDateTime(value: string) {
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

  return new Date(Date.UTC(year, month - 1, day, hour, minute)).toISOString();
}

function formatLocalPreview(value: string) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(new Date(value));
}

function prepareVoters(rows: DraftVoterRow[]): PreparedVoters {
  const completeRows: string[] = [];
  const partialRowNumbers: number[] = [];

  rows.forEach((row, index) => {
    const nick = row.nick.trim();
    const signalUsername = row.signalUsername.trim().toLowerCase();

    if (!nick && !signalUsername) {
      return;
    }

    if (!nick || !signalUsername) {
      partialRowNumbers.push(index + 1);
      return;
    }

    completeRows.push(`${nick},${signalUsername}`);
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
      const [nick = "", signalUsername = ""] = line
        .split(",")
        .map((value) => value.trim());

      return {
        id: generateRowId(),
        nick,
        signalUsername
      };
    });
}

export function AdminPollCreateForm({
  daoMembers = []
}: {
  daoMembers?: DaoMemberOption[];
}) {
  const router = useRouter();
  const hasDaoMembers = daoMembers.length > 0;
  const [opensAtLocal, setOpensAtLocal] = useState("");
  const [closesAtLocal, setClosesAtLocal] = useState("");
  const [rows, setRows] = useState<DraftVoterRow[]>([createRow()]);
  const [bulkInput, setBulkInput] = useState("");
  const [proposalType, setProposalType] = useState<ProposalType>("STANDARD");
  const [membershipNick, setMembershipNick] = useState("");
  const [membershipSignalUsername, setMembershipSignalUsername] = useState("");
  const [membershipTargetMemberId, setMembershipTargetMemberId] = useState(
    daoMembers[0]?.id ?? ""
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const preparedVoters = useMemo(() => prepareVoters(rows), [rows]);
  const opensAtIso = toUtcIsoDateTime(opensAtLocal);
  const closesAtIso = toUtcIsoDateTime(closesAtLocal);

  function updateRow(id: string, field: "nick" | "signalUsername", value: string) {
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

    if (!hasDaoMembers) {
      if (preparedVoters.partialRowNumbers.length) {
        setError(
          `Complete both user ID and Signal username for voter row${preparedVoters.partialRowNumbers.length === 1 ? "" : "s"} ${preparedVoters.partialRowNumbers.join(", ")}.`
        );
        return;
      }

      if (preparedVoters.completeCount === 0) {
        setError("Add at least one voter with both user ID and Signal username.");
        return;
      }
    }

    if (hasDaoMembers && proposalType === "ADD_MEMBER") {
      if (!membershipNick.trim() || !membershipSignalUsername.trim()) {
        setError("Add DAO member proposals require a nick and Signal username.");
        return;
      }
    }

    if (hasDaoMembers && proposalType === "REMOVE_MEMBER" && !membershipTargetMemberId) {
      setError("Select the DAO member this removal proposal targets.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    formData.set("audience", hasDaoMembers ? "DAO_MEMBERS" : "CUSTOM");
    formData.set("voters", hasDaoMembers ? "" : preparedVoters.payload);

    if (hasDaoMembers && proposalType !== "STANDARD") {
      formData.set("membershipActionType", proposalType);

      if (proposalType === "ADD_MEMBER") {
        formData.set("membershipNick", membershipNick);
        formData.set("membershipSignalUsername", membershipSignalUsername);
      } else {
        formData.set("membershipTargetMemberId", membershipTargetMemberId);
      }
    } else {
      formData.set("membershipActionType", "");
    }

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
        Set the question, visible answers, voter basket, and window. After this, the
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
          <h3>Single-choice labels</h3>
        </div>
        <div className="editorial-option-grid">
          <label className="field">
            <span className="field-label">A label</span>
            <input id="optionALabel" name="optionALabel" defaultValue="Approve" required />
          </label>
          <label className="field">
            <span className="field-label">B label</span>
            <input id="optionBLabel" name="optionBLabel" defaultValue="Reject" required />
          </label>
          <label className="field">
            <span className="field-label">C label</span>
            <input id="optionCLabel" name="optionCLabel" defaultValue="Abstain" />
          </label>
        </div>
      </section>

      <section className="editorial-module">
        <div className="editorial-module-head">
          <p className="section-label">Governance rule</p>
          <h3>DAO DAO single-choice outcome</h3>
        </div>
        <div className="meta-chip-row">
          <span className="meta-chip">Single choice</span>
          <span className="meta-chip">Quorum {DEFAULT_QUORUM_PERCENT}%</span>
          <span className="meta-chip">
            Pass {DEFAULT_PASSING_THRESHOLD_PERCENT}%
          </span>
          <span className="meta-chip">A / all valid votes</span>
        </div>
        <p className="field-hint">
          Abstain counts toward quorum. The pass threshold is calculated from
          all valid votes after quorum is met.
        </p>
      </section>

      <section className="editorial-module">
        <div className="editorial-module-head">
          <p className="section-label">Voters</p>
          <h3>{hasDaoMembers ? "Use the Zechub DAO member basket" : "Build the initial delivery list"}</h3>
        </div>
        {hasDaoMembers ? (
          <>
            <p className="field-hint">
              This poll will be sent to all active Zechub DAO members by Signal.
              The admin cannot edit this basket here; membership changes require a
              passed poll.
            </p>
            <div className="meta-chip-row">
              <span className="meta-chip">DAO member basket</span>
              <span className="meta-chip">{daoMembers.length} active voter(s)</span>
              <span className="meta-chip">Signal only</span>
            </div>
            <div className="editorial-table-wrap">
              <table className="editorial-table">
                <thead>
                  <tr>
                    <th>User ID</th>
                    <th>Signal username</th>
                  </tr>
                </thead>
                <tbody>
                  {daoMembers.map((member) => (
                    <tr key={member.id}>
                      <td>{member.nick}</td>
                      <td>{member.signalUsername}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <input type="hidden" name="audience" value="DAO_MEMBERS" readOnly />
            <input type="hidden" name="voters" value="" readOnly />
          </>
        ) : (
          <>
            <p className="field-hint">
              Required: at least one complete voter row. Use Signal usernames only,
              including the numeric suffix. Phone numbers are not accepted. This
              manual setup is for the first basket or legacy custom polls only.
            </p>
            <div className="editorial-table-wrap">
              <table className="editorial-table">
                <thead>
                  <tr>
                    <th>User ID</th>
                    <th>Signal username</th>
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
                          name={`voter-signal-${row.id}`}
                          aria-label={`Voter Signal username ${index + 1}`}
                          value={row.signalUsername}
                          onChange={(event) =>
                            updateRow(row.id, "signalUsername", event.currentTarget.value)
                          }
                          placeholder="username.42"
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
                  placeholder={"voter01,username.42\nvoter02,another_user.99"}
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
            <input type="hidden" name="audience" value="CUSTOM" readOnly />
            <input type="hidden" name="voters" value={preparedVoters.payload} readOnly />
          </>
        )}
      </section>

      {hasDaoMembers ? (
        <section className="editorial-module">
          <div className="editorial-module-head">
            <p className="section-label">Proposal type</p>
            <h3>Standard decision or membership change</h3>
          </div>
          <p className="field-hint">
            Membership changes are not direct admin actions. The poll is sent to
            the current basket and the change applies only after the poll closes
            with a passed decision.
          </p>
          <label className="field" htmlFor="proposalType">
            <span className="field-label">Governance action</span>
            <select
              id="proposalType"
              value={proposalType}
              onChange={(event) => setProposalType(event.currentTarget.value as ProposalType)}
            >
              <option value="STANDARD">Standard poll</option>
              <option value="ADD_MEMBER">Add DAO member if passed</option>
              <option value="REMOVE_MEMBER">Remove DAO member if passed</option>
            </select>
          </label>
          {proposalType === "ADD_MEMBER" ? (
            <div className="editorial-option-grid">
              <label className="field">
                <span className="field-label">New member nick</span>
                <input
                  value={membershipNick}
                  onChange={(event) => setMembershipNick(event.currentTarget.value)}
                  placeholder="new_member"
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore="true"
                />
              </label>
              <label className="field">
                <span className="field-label">New member Signal username</span>
                <input
                  value={membershipSignalUsername}
                  onChange={(event) =>
                    setMembershipSignalUsername(event.currentTarget.value)
                  }
                  placeholder="username.42"
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore="true"
                />
              </label>
            </div>
          ) : null}
          {proposalType === "REMOVE_MEMBER" ? (
            <label className="field" htmlFor="membershipTargetMemberId">
              <span className="field-label">Member to remove if passed</span>
              <select
                id="membershipTargetMemberId"
                value={membershipTargetMemberId}
                onChange={(event) =>
                  setMembershipTargetMemberId(event.currentTarget.value)
                }
              >
                {daoMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.nick} · {member.signalUsername}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <input type="hidden" name="membershipActionType" value={proposalType} readOnly />
          <input type="hidden" name="membershipNick" value={membershipNick} readOnly />
          <input
            type="hidden"
            name="membershipSignalUsername"
            value={membershipSignalUsername}
            readOnly
          />
          <input
            type="hidden"
            name="membershipTargetMemberId"
            value={membershipTargetMemberId}
            readOnly
          />
        </section>
      ) : null}

      <section className="editorial-module">
        <div className="editorial-module-head">
          <p className="section-label">Window</p>
          <h3>Set the official global UTC window</h3>
        </div>
        <p className="field-hint">
          Enter the official UTC open and close time. Voters see the same window in
          their own local timezone. Minimum window: {MIN_POLL_WINDOW_HOURS} hours.
        </p>
        <div className="editorial-option-grid editorial-option-grid--window">
          <label className="field">
            <span className="field-label">Opens at (UTC)</span>
            <input
              id="opensAtLocal"
              name="opensAtLocal"
              type="datetime-local"
              value={opensAtLocal}
              onChange={(event) => setOpensAtLocal(event.currentTarget.value)}
              required
            />
            <input type="hidden" name="opensAt" value={opensAtIso} />
          </label>
          <label className="field">
            <span className="field-label">Closes at (UTC)</span>
            <input
              id="closesAtLocal"
              name="closesAtLocal"
              type="datetime-local"
              value={closesAtLocal}
              onChange={(event) => setClosesAtLocal(event.currentTarget.value)}
              required
            />
            <input type="hidden" name="closesAt" value={closesAtIso} />
          </label>
        </div>
        {opensAtIso && closesAtIso ? (
          <p className="field-hint">
            Official window: {formatOfficialPollDateTime(opensAtIso)} to{" "}
            {formatOfficialPollDateTime(closesAtIso)}. Your local preview:{" "}
            {formatLocalPreview(opensAtIso)} to {formatLocalPreview(closesAtIso)}.
          </p>
        ) : null}
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
