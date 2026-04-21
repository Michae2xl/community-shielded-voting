import { NextResponse, type NextRequest } from "next/server";
import { canManagePolls } from "@/lib/auth/guards";
import { readSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { buildAdminReceiptSummary } from "@/lib/services/admin-receipts";

export const receiptRecencyOrderBy = [{ id: "desc" as const }];

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ pollId: string }> }
) {
  const session = await readSession();

  if (!session || !canManagePolls(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { pollId } = await context.params;
  const poll = await db.poll.findUnique({
    where: { id: pollId },
    select: {
      optionALabel: true,
      optionBLabel: true,
      optionCLabel: true,
      optionDLabel: true,
      optionELabel: true
    }
  });

  const receipts = await db.voteReceipt.findMany({
    where: {
      pollId
    },
    select: {
      optionLetter: true,
      status: true
    }
  });

  return NextResponse.json({
    summary: buildAdminReceiptSummary(poll ?? {}, receipts)
  });
}
