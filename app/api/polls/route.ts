import { NextResponse } from "next/server";
import { db } from "@/lib/db";

function formatZatToZec(value: bigint) {
  const digits = value.toString().padStart(9, "0");
  const whole = digits.slice(0, -8) || "0";
  const fraction = digits.slice(-8).replace(/0+$/g, "");

  return fraction ? `${whole}.${fraction}` : whole;
}

export async function GET() {
  const polls = await db.poll.findMany({
    where: {
      status: "OPEN"
    },
    orderBy: {
      opensAt: "asc"
    },
    select: {
      id: true,
      question: true,
      status: true,
      feeZat: true,
      opensAt: true,
      closesAt: true
    }
  });

  return NextResponse.json({
    polls: polls.map((poll) => ({
      id: poll.id,
      question: poll.question,
      status: poll.status,
      feeZec: formatZatToZec(poll.feeZat),
      opensAt: poll.opensAt.toISOString(),
      closesAt: poll.closesAt.toISOString()
    }))
  });
}
