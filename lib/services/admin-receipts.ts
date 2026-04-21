import { VoteReceiptStatus } from "@prisma/client";
import {
  OPTION_LETTERS,
  getPollOptionLabelMap,
  type OptionLabelFields,
  type OptionLetter
} from "@/lib/domain/options";

type ReceiptSummaryRow = {
  status: VoteReceiptStatus;
  optionLetter: OptionLetter;
};

export type AdminReceiptSummary = {
  totalReceipts: number;
  statuses: Record<VoteReceiptStatus, number>;
  options: Record<
    OptionLetter,
    {
      label: string;
      total: number;
    }
  >;
};

export function buildAdminReceiptSummary(
  poll: OptionLabelFields,
  receipts: ReceiptSummaryRow[]
): AdminReceiptSummary {
  const optionLabels = getPollOptionLabelMap(poll);
  const summary: AdminReceiptSummary = {
    totalReceipts: receipts.length,
    statuses: {
      PENDING: 0,
      CONFIRMED: 0,
      REJECTED: 0,
      DUPLICATE_IGNORED: 0
    },
    options: {
      A: { label: optionLabels.A, total: 0 },
      B: { label: optionLabels.B, total: 0 },
      C: { label: optionLabels.C, total: 0 },
      D: { label: optionLabels.D, total: 0 },
      E: { label: optionLabels.E, total: 0 }
    }
  };

  for (const receipt of receipts) {
    summary.statuses[receipt.status] += 1;
    summary.options[receipt.optionLetter].total += 1;
  }

  return summary;
}

export function adminReceiptSummaryCsv(summary: AdminReceiptSummary) {
  const lines = ["metric,value", `total_receipts,${summary.totalReceipts}`];

  for (const [status, count] of Object.entries(summary.statuses)) {
    lines.push(`status_${status.toLowerCase()},${count}`);
  }

  for (const letter of OPTION_LETTERS) {
    lines.push(`option_${letter}_label,${summary.options[letter].label}`);
    lines.push(`option_${letter}_total,${summary.options[letter].total}`);
  }

  return lines.join("\n");
}
