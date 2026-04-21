import { NextResponse, type NextRequest } from "next/server";
import { UserRole, UserStatus } from "@prisma/client";
import { z } from "zod";
import { hashPassword } from "@/lib/auth/password";
import { writeSessionCookie } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { buildRequestUrl } from "@/lib/http/request-url";
import { rejectIfUntrustedWriteOrigin } from "@/lib/http/write-origin";

const signupSchema = z.object({
  userId: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9._-]+$/),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(256)
});

function buildFailureRedirect(request: NextRequest, error = "1") {
  const url = buildRequestUrl(request, "/signup");
  url.searchParams.set("error", error);
  return url;
}

async function readSignupFields(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as
      | {
          userId?: unknown;
          email?: unknown;
          password?: unknown;
        }
      | null;

    return {
      userId: typeof body?.userId === "string" ? body.userId.trim() : "",
      email: typeof body?.email === "string" ? body.email.trim() : "",
      password: typeof body?.password === "string" ? body.password : ""
    };
  }

  const formData = await request.formData().catch(() => null);

  return {
    userId: String(formData?.get("userId") ?? "").trim(),
    email: String(formData?.get("email") ?? "").trim(),
    password: String(formData?.get("password") ?? "")
  };
}

export async function POST(request: NextRequest) {
  const untrustedOrigin = rejectIfUntrustedWriteOrigin(request);

  if (untrustedOrigin) {
    return NextResponse.redirect(
      buildFailureRedirect(request, "forbidden_origin"),
      303
    );
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.redirect(
      buildFailureRedirect(request, "service_unavailable"),
      303
    );
  }

  const parsed = signupSchema.safeParse(await readSignupFields(request));

  if (!parsed.success) {
    return NextResponse.redirect(
      buildFailureRedirect(request, "invalid_input"),
      303
    );
  }

  const { userId, email, password } = parsed.data;
  const existing = await db.user.findFirst({
    where: {
      OR: [{ nick: userId }, { email }]
    },
    select: {
      nick: true,
      email: true
    }
  });

  if (existing?.nick === userId) {
    return NextResponse.redirect(
      buildFailureRedirect(request, "user_id_taken"),
      303
    );
  }

  if (existing?.email === email) {
    return NextResponse.redirect(
      buildFailureRedirect(request, "email_taken"),
      303
    );
  }

  const user = await db.user.create({
    data: {
      nick: userId,
      email,
      passwordHash: await hashPassword(password),
      role: UserRole.CREATOR,
      status: UserStatus.ACTIVE
    }
  });

  await writeSessionCookie({
    subjectType: "user",
    userId: user.id,
    nick: user.nick,
    role: user.role
  });

  return NextResponse.redirect(buildRequestUrl(request, "/admin/polls"), 303);
}
