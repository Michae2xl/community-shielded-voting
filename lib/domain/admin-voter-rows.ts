type AdminTurnoutAccessInput = {
  assignments: Array<{
    ticket: {
      status: string;
    };
  }>;
};

type AdminVoterAccessInput = AdminTurnoutAccessInput & {
  id: string;
  nick: string;
  email?: string | null;
  signalUsername?: string | null;
  invites: Array<{
    status: string;
  }>;
  assignments: Array<{
    ticket: {
      status: string;
    };
  }>;
};

export type AdminVoterRow = {
  id: string;
  nick: string;
  email?: string | null;
  signalUsername?: string | null;
  deliveryTarget: string;
  inviteStatus: string;
  statusTone: "neutral" | "success" | "warning";
  canRemove: boolean;
  canSelect: boolean;
};

export type AdminTurnout = {
  completed: number;
  total: number;
  percent: number;
  label: string;
};

export function buildAdminTurnout(accesses: AdminTurnoutAccessInput[]): AdminTurnout {
  const total = accesses.length;
  const completed = accesses.filter((access) =>
    access.assignments.some((assignment) => assignment.ticket.status === "VOTED")
  ).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    completed,
    total,
    percent,
    label: `${completed}/${total} received (${percent}%)`
  };
}

function visibleInviteStatus(inviteStatuses: string[]) {
  if (inviteStatuses.includes("OPENED")) {
    return "Opened";
  }

  if (inviteStatuses.includes("SENT")) {
    return "Sent";
  }

  if (inviteStatuses.includes("FAILED")) {
    return "Failed";
  }

  return "Pending";
}

function needsDeliveryAction(inviteStatuses: string[]) {
  return inviteStatuses.length === 0 || inviteStatuses.includes("PENDING") || inviteStatuses.includes("FAILED");
}

export function buildAdminVoterRows(
  accesses: AdminVoterAccessInput[],
  input: {
    resultsVisible: boolean;
  }
): AdminVoterRow[] {
  return accesses.map((access) => {
    const ticketStatuses = access.assignments.map((assignment) => assignment.ticket.status);
    const inviteStatuses = access.invites.map((invite) => invite.status);
    const hasCompletedVote = ticketStatuses.includes("VOTED");
    const inviteStatus =
      input.resultsVisible && hasCompletedVote
        ? "Vote received"
        : visibleInviteStatus(inviteStatuses);
    const statusTone =
      input.resultsVisible && hasCompletedVote
        ? "success"
        : inviteStatus === "Failed"
          ? "warning"
          : "neutral";
    const canRemove = inviteStatuses.length === 0 && ticketStatuses.length === 0;

    return {
      id: access.id,
      nick: access.nick,
      email: access.email,
      signalUsername: access.signalUsername,
      deliveryTarget: access.signalUsername ?? access.email ?? "No delivery ID",
      inviteStatus,
      statusTone,
      canRemove,
      canSelect: needsDeliveryAction(inviteStatuses) && !(input.resultsVisible && hasCompletedVote)
    };
  });
}
