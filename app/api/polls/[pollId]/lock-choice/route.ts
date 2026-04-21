import { NextResponse, type NextRequest } from "next/server";
import { OPTION_LETTERS, type OptionLetter } from "@/lib/domain/options";
import { readSession } from "@/lib/auth/session";
import { rejectIfUntrustedWriteOrigin } from "@/lib/http/write-origin";
import {
  lockTicketChoice,
  TicketLockingError
} from "@/lib/services/ticket-locking";

function isOptionLetter(value: unknown): value is OptionLetter {
  return typeof value === "string" && OPTION_LETTERS.includes(value as OptionLetter);
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

  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        optionLetter?: unknown;
        confirmed?: unknown;
      }
    | null;

  if (!isOptionLetter(body?.optionLetter) || body?.confirmed !== true) {
    return NextResponse.json({ error: "INVALID_LOCK_REQUEST" }, { status: 400 });
  }

  const { pollId } = await context.params;

  try {
    const locked = await lockTicketChoice(
      session.subjectType === "poll_voter_access"
        ? {
            pollId,
            pollVoterAccessId: session.pollVoterAccessId,
            optionLetter: body.optionLetter
          }
        : {
            pollId,
            userId: session.userId,
            optionLetter: body.optionLetter
          }
    );

    return NextResponse.json(locked);
  } catch (error) {
    if (error instanceof TicketLockingError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }

    throw error;
  }
}
