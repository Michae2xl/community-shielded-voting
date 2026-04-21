import { canManagePolls } from "@/lib/auth/guards";
import { readSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { adminReceiptSummaryCsv, buildAdminReceiptSummary } from "@/lib/services/admin-receipts";

export async function GET(
  _request: Request,
  context: { params: Promise<{ pollId: string }> }
) {
  const session = await readSession();

  if (!session || !canManagePolls(session.role)) {
    return new Response("forbidden", { status: 403 });
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

  const csv = adminReceiptSummaryCsv(buildAdminReceiptSummary(poll ?? {}, receipts));

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${pollId}-receipt-summary.csv"`
    }
  });
}
