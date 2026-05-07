import { NextResponse, type NextRequest } from "next/server";
import { ZodError, z } from "zod";
import { canManagePolls } from "@/lib/auth/guards";
import { readSession } from "@/lib/auth/session";
import { PollVoterParseError, parsePollVoterLines } from "@/lib/domain/poll-voters";
import { rejectIfUntrustedWriteOrigin } from "@/lib/http/write-origin";
import {
  bootstrapDaoMemberBasket,
  DaoMemberServiceError
} from "@/lib/services/dao-members";

const bodySchema = z.object({
  members: z.string().min(1)
});

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

    const body = bodySchema.parse(await request.json());
    const voters = parsePollVoterLines(body.members);
    const members = await bootstrapDaoMemberBasket({ voters });

    return NextResponse.json({ members });
  } catch (error) {
    if (error instanceof DaoMemberServiceError) {
      return jsonError(error.code, error.status, error.details);
    }

    if (error instanceof PollVoterParseError) {
      return jsonError("INVALID_DAO_MEMBER_INPUT", 400, {
        issues: [
          {
            path: ["members"],
            message: error.message
          }
        ]
      });
    }

    if (error instanceof ZodError) {
      return jsonError("INVALID_DAO_MEMBER_INPUT", 400, {
        issues: error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message
        }))
      });
    }

    throw error;
  }
}
