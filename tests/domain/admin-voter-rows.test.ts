import { describe, expect, it } from "vitest";
import {
  buildAdminTurnout,
  buildAdminVoterRows
} from "@/lib/domain/admin-voter-rows";

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

describe("buildAdminTurnout", () => {
  it("returns aggregate vote count and turnout percentage", () => {
    const turnout = buildAdminTurnout([
      {
        id: "access_1",
        nick: "michae2xl",
        email: "michaelguima@proton.me",
        invites: [{ status: "SENT" }],
        assignments: [{ ticket: { status: "VOTED" } }]
      },
      {
        id: "access_2",
        nick: "alice",
        email: "alice@example.com",
        invites: [{ status: "SENT" }],
        assignments: [{ ticket: { status: "ISSUED" } }]
      }
    ]);

    expect(turnout).toEqual({
      completed: 1,
      total: 2,
      percent: 50,
      label: "1/2 received (50%)"
    });
  });
});
