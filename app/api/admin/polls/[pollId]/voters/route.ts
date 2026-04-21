import { NextResponse, type NextRequest } from "next/server";
import { ZodError, z } from "zod";
import { canManagePolls } from "@/lib/auth/guards";
import { creatorOwnsPoll } from "@/lib/auth/poll-ownership";
import { readSession } from "@/lib/auth/session";
import { rejectIfUntrustedWriteOrigin } from "@/lib/http/write-origin";
import {
  createPollVoterAccesses,
  PollVoterAccessServiceError
} from "@/lib/services/poll-voter-access";

const voterSchema = z.object({
  nick: z.string().trim().min(1),
  email: z.string().trim().email().transform((value) => value.toLowerCase())
});

const bodySchema = z.object({
  voters: z.array(voterSchema).min(1)
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ pollId: string }> }
) {
  const untrustedOrigin = rejectIfUntrustedWriteOrigin(request);

  if (untrustedOrigin) {
    return untrustedOrigin;
  }

  const session = await readSession();

  if (!session || !canManagePolls(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const { pollId } = await context.params;
    const ownsPoll = await creatorOwnsPoll(pollId, session.userId);

    if (!ownsPoll) {
      return NextResponse.json({ error: "POLL_NOT_FOUND" }, { status: 404 });
    }

    const body = bodySchema.parse(await request.json());
    const created = await createPollVoterAccesses({
      pollId,
      voters: body.voters
    });

    return NextResponse.json({ created });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "INVALID_POLL_VOTER_INPUT",
          details: {
            issues: error.issues.map((issue) => ({
              path: issue.path,
              message: issue.message
            }))
          }
        },
        { status: 400 }
      );
    }

    if (error instanceof PollVoterAccessServiceError) {
      return NextResponse.json(
        { error: error.code, details: error.details },
        { status: error.status }
      );
    }

    throw error;
  }
}
