import { NextResponse, type NextRequest } from "next/server";
import { canManagePolls } from "@/lib/auth/guards";
import { readSession } from "@/lib/auth/session";
import { getRequestOrigin } from "@/lib/http/request-url";
import { rejectIfUntrustedWriteOrigin } from "@/lib/http/write-origin";
import {
  InviteServiceError,
  sendPollInvites
} from "@/lib/services/poll-invites";

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

  const { pollId } = await context.params;
  const baseUrl = process.env.APP_BASE_URL || getRequestOrigin(request);

  try {
    const result = await sendPollInvites({
      pollId,
      baseUrl
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof InviteServiceError) {
      return NextResponse.json(
        {
          error: error.code,
          details: error.details
        },
        { status: error.status }
      );
    }

    throw error;
  }
}
