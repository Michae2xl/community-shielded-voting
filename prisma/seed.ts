import { PrismaClient, UserRole } from "@prisma/client";
import { hashSync } from "bcryptjs";

const prisma = new PrismaClient();

function readRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required for db:seed`);
  }

  return value;
}

async function main() {
  const adminNick = process.env.SEED_ADMIN_NICK?.trim() || "admin";
  const adminEmail =
    process.env.SEED_ADMIN_EMAIL?.trim() || "admin@example.com";
  const adminPassword = readRequiredEnv("SEED_ADMIN_PASSWORD");

  await prisma.user.upsert({
    where: { nick: adminNick },
    update: {
      email: adminEmail,
      role: UserRole.ADMIN
    },
    create: {
      nick: adminNick,
      email: adminEmail,
      passwordHash: hashSync(adminPassword, 10),
      role: UserRole.ADMIN
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
