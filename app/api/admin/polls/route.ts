import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { canManagePolls } from "@/lib/auth/guards";
import { readSession } from "@/lib/auth/session";
import { PollVoterParseError, parsePollVoterLines } from "@/lib/domain/poll-voters";
import { rejectIfUntrustedWriteOrigin } from "@/lib/http/write-origin";
import { PollServiceError, createDraftPoll } from "@/lib/services/polls";

function jsonError(
  error: string,
  status: 400 | 404 | 409,
  details?: Record<string, unknown>
) {
  return NextResponse.json({ error, details }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const untrustedOrigin = rejectIfUntrustedWriteOrigin(request);

    if (untrustedOrigin) {
      return untrustedOrigin;
    }

    const session = await readSession();

    if (!session || !canManagePolls(session.role)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const voters = parsePollVoterLines(String(formData.get("voters") ?? ""));
    const audience = String(formData.get("audience") ?? "CUSTOM");
    const membershipActionType = String(
      formData.get("membershipActionType") ?? ""
    );
    const membershipAction =
      membershipActionType === "ADD_MEMBER"
        ? {
            type: "ADD_MEMBER" as const,
            nick: String(formData.get("membershipNick") ?? ""),
            signalUsername: String(formData.get("membershipSignalUsername") ?? "")
          }
        : membershipActionType === "REMOVE_MEMBER"
          ? {
              type: "REMOVE_MEMBER" as const,
              targetMemberId: String(formData.get("membershipTargetMemberId") ?? "")
            }
          : undefined;

    const poll = await createDraftPoll(
      {
        question: String(formData.get("question") ?? ""),
        opensAt: String(formData.get("opensAt") ?? ""),
        closesAt: String(formData.get("closesAt") ?? ""),
        optionALabel: String(formData.get("optionALabel") ?? ""),
        optionBLabel: String(formData.get("optionBLabel") ?? ""),
        optionCLabel: String(formData.get("optionCLabel") ?? ""),
        optionDLabel: String(formData.get("optionDLabel") ?? ""),
        optionELabel: String(formData.get("optionELabel") ?? ""),
        audience: audience as "CUSTOM" | "DAO_MEMBERS",
        voters,
        membershipAction
      },
      session.userId
    );

    return NextResponse.json({ pollId: poll.id });
  } catch (error) {
    if (error instanceof PollServiceError) {
      return jsonError(error.code, error.status, error.details);
    }

    if (error instanceof ZodError) {
      return jsonError("INVALID_POLL_INPUT", 400, {
        issues: error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message
        }))
      });
    }

    if (error instanceof PollVoterParseError) {
      return jsonError("INVALID_POLL_INPUT", 400, {
        issues: [
          {
            path: ["voters"],
            message: error.message
          }
        ]
      });
    }

    throw error;
  }
}
