import { NextResponse, type NextRequest } from "next/server";
import { ZodError, z } from "zod";
import { canManagePolls } from "@/lib/auth/guards";
import { readSession } from "@/lib/auth/session";
import { getActiveOptionLetters } from "@/lib/domain/options";
import { db } from "@/lib/db";
import { getRequestOrigin } from "@/lib/http/request-url";
import { rejectIfUntrustedWriteOrigin } from "@/lib/http/write-origin";
import {
  InviteServiceError,
  sendPollInvites
} from "@/lib/services/poll-invites";
import { issueTicketForVoter } from "@/lib/services/tickets";
import { ZcashConfigError } from "@/lib/zcash/runtime";

const bodySchema = z.object({
  pollVoterAccessIds: z.array(z.string().min(1)).min(1)
});

function formatZatToZec(value: bigint) {
  const digits = value.toString().padStart(9, "0");
  const whole = digits.slice(0, -8) || "0";
  const fraction = digits.slice(-8).replace(/0+$/g, "");

  return fraction ? `${whole}.${fraction}` : whole;
}

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
    const body = bodySchema.parse(await request.json());
    const { pollId } = await context.params;
    const poll = await db.poll.findUnique({
      where: { id: pollId },
      select: {
        id: true,
        feeZat: true,
        optionALabel: true,
        optionBLabel: true,
        optionCLabel: true,
        optionDLabel: true,
        optionELabel: true
      }
    });

    if (!poll) {
      return NextResponse.json({ error: "POLL_NOT_FOUND" }, { status: 404 });
    }

    const selectedAccesses = await db.pollVoterAccess.findMany({
      where: {
        pollId,
        status: "ACTIVE",
        id: {
          in: body.pollVoterAccessIds
        }
      },
      select: {
        id: true
      }
    });

    const optionLetters = getActiveOptionLetters(poll);

    for (const access of selectedAccesses) {
      try {
        await issueTicketForVoter({
          pollId,
          pollVoterAccessId: access.id,
          feeZec: formatZatToZec(poll.feeZat),
          optionLetters
        });
      } catch (error) {
        if (error instanceof ZcashConfigError) {
          return NextResponse.json(
            { error: "ZCASH_NOT_CONFIGURED" },
            { status: 503 }
          );
        }

        throw error;
      }
    }

    const baseUrl = process.env.APP_BASE_URL || getRequestOrigin(request);
    const result = await sendPollInvites({
      pollId,
      baseUrl,
      pollVoterAccessIds: selectedAccesses.map((access) => access.id)
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "INVALID_RESEND_SELECTION",
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

    if (error instanceof InviteServiceError) {
      return NextResponse.json(
        { error: error.code, details: error.details },
        { status: error.status }
      );
    }

    throw error;
  }
}
