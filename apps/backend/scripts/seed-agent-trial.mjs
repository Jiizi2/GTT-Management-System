import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcrypt";
import { isEmail } from "class-validator";
import dotenv from "dotenv";

export const DEFAULT_TRIAL_EMAIL = "portal.trial@ghaniya.local";

export function resolveTrialEmail(args) {
  if (args.length === 0) return DEFAULT_TRIAL_EMAIL;
  if (args.length !== 2 || args[0] !== "--email") {
    throw new Error("Usage: npm run db:seed:agent-trial -- [--email <email>]");
  }
  const email = args[1].trim().toLowerCase();
  if (email.length > 160 || !isEmail(email)) {
    throw new Error("Provide a valid email address of at most 160 characters.");
  }
  return email;
}

export async function seedAgentTrial(prisma, email) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.agentPortalUser.findUnique({
      where: { normalizedIdentifier: email },
      select: {
        id: true,
        email: true,
        status: true,
        agent: {
          select: {
            id: true, code: true, name: true, type: true, status: true,
            _count: { select: { groups: true } },
          },
        },
      },
    });
    if (existing) {
      if (existing.status !== "ACTIVE" || existing.agent.status !== "ACTIVE" || existing.agent.type !== "PARTNER") {
        throw new Error("The existing trial account is not eligible to log in. Review it through Super Admin account management.");
      }
      return { created: false, accountId: existing.id, email: existing.email, agent: existing.agent };
    }

    const agent = await tx.agent.findFirst({
      where: { type: "PARTNER", status: "ACTIVE", groups: { some: {} } },
      orderBy: [{ groups: { _count: "desc" } }, { code: "asc" }],
      select: { id: true, code: true, name: true, _count: { select: { groups: true } } },
    });
    if (!agent) throw new Error("No active Partner Agent with groups was found. No account was created.");

    const password = `Aa1!${randomBytes(18).toString("base64url")}`;
    const account = await tx.agentPortalUser.create({
      data: {
        agentId: agent.id,
        displayName: `Portal Trial - ${agent.name}`.slice(0, 120),
        email,
        normalizedIdentifier: email,
        passwordHash: await hash(password, 12),
        status: "ACTIVE",
        mustChangePassword: true,
      },
      select: { id: true },
    });
    await tx.agentPortalAccountAuditLog.create({
      data: {
        portalUserId: account.id,
        agentId: agent.id,
        action: "CREATED",
        // A CLI seed has no authenticated internal user.
        actorAuthUserId: null,
      },
    });
    return { created: true, accountId: account.id, email, agent, password };
  });
}

export async function main(args = process.argv.slice(2)) {
  if (args.length === 1 && ["--help", "-h"].includes(args[0])) {
    console.log("Create one trial Portal Agent account for the active Partner Agent with the most groups.");
    console.log("Usage: npm run db:seed:agent-trial -- [--email <email>]");
    console.log(`Default email: ${DEFAULT_TRIAL_EMAIL}. Existing accounts and passwords are preserved.`);
    return;
  }
  dotenv.config({ quiet: true });
  const email = resolveTrialEmail(args);
  if (process.env.DATA_SOURCE !== "prisma" || !process.env.DATABASE_URL?.trim()) {
    throw new Error("DATA_SOURCE=prisma and DATABASE_URL are required.");
  }
  const prisma = new PrismaClient();
  try {
    const result = await seedAgentTrial(prisma, email);
    console.log(result.created ? "Trial Portal Agent account created." : "Trial account already exists; credentials and ownership were preserved.");
    console.log(`Agent: ${result.agent.name} (${result.agent.code})`);
    console.log(`Groups: ${result.agent._count.groups}`);
    console.log(`Email: ${result.email}`);
    if (result.created) console.log(`Password (save now; shown only on creation): ${result.password}`);
    console.log("Login: /agent/login");
    console.log("To disable or reset this account, use Super Admin Portal Agent account management.");
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Agent trial seed failed: ${error instanceof Error ? error.message : "unknown error"}`);
    process.exitCode = 1;
  });
}
