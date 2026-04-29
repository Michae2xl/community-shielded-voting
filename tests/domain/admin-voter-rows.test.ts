import { describe, expect, it } from "vitest";
import { buildAdminVoterRows } from "@/lib/domain/admin-voter-rows";

describe("buildAdminVoterRows", () => {
  it("masks completed voter status before results are released", () => {
    const [row] = buildAdminVoterRows(
      [
        {
          id: "access_1",
          nick: "michae2xl",
          email: "michaelguima@proton.me",
          invites: [{ status: "SENT" }],
          assignments: [{ ticket: { status: "VOTED" } }]
        }
      ],
      { resultsVisible: false }
    );

    expect(row.inviteStatus).toBe("Sent");
    expect(row.statusTone).toBe("neutral");
    expect(row.canSelect).toBe(false);
  });

  it("reveals completed voter status after results are released", () => {
    const [row] = buildAdminVoterRows(
      [
        {
          id: "access_1",
          nick: "michae2xl",
          email: "michaelguima@proton.me",
          invites: [{ status: "SENT" }],
          assignments: [{ ticket: { status: "VOTED" } }]
        }
      ],
      { resultsVisible: true }
    );

    expect(row.inviteStatus).toBe("Vote received");
    expect(row.statusTone).toBe("success");
    expect(row.canSelect).toBe(false);
  });

  it("keeps failed delivery rows selectable without using vote completion", () => {
    const [row] = buildAdminVoterRows(
      [
        {
          id: "access_1",
          nick: "alice",
          email: "alice@example.com",
          invites: [{ status: "FAILED" }],
          assignments: [{ ticket: { status: "VOTED" } }]
        }
      ],
      { resultsVisible: false }
    );

    expect(row.inviteStatus).toBe("Failed");
    expect(row.statusTone).toBe("warning");
    expect(row.canSelect).toBe(true);
  });
});
