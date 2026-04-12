import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashAuthPasswordAsync } from "./auth/auth-password";
import { normalizeAuthEmail, normalizeAuthUsername } from "./auth/auth-default-users";
import { resolveConfiguredDataSource, resolveConfiguredString } from "./config/app-config";

type BootstrapSuperAdminInput = {
  name: string;
  email: string;
  password: string;
  username: string;
};

type BootstrapSuperAdminOptionValues = {
  name?: string;
  email?: string;
  password?: string;
  username?: string;
  help?: boolean;
};

function readOptionName(argument: string): string | null {
  if (!argument.startsWith("--")) {
    return null;
  }

  return argument.slice(2).trim() || null;
}

export function deriveBootstrapUsername(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, ".")
    .replace(/[._-]{2,}/g, ".")
    .replace(/^[._-]+|[._-]+$/g, "");

  return normalized || "user";
}

export function parseBootstrapSuperAdminOptions(argv: string[]): BootstrapSuperAdminOptionValues {
  const parsed: BootstrapSuperAdminOptionValues = {};

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]?.trim() ?? "";
    if (!argument) {
      continue;
    }

    if (argument === "--help" || argument === "-h") {
      parsed.help = true;
      continue;
    }

    const equalsIndex = argument.indexOf("=");
    const rawOptionName = equalsIndex >= 0 ? argument.slice(0, equalsIndex) : argument;
    const inlineValue = equalsIndex >= 0 ? argument.slice(equalsIndex + 1) : undefined;
    const optionName = readOptionName(rawOptionName);
    if (!optionName) {
      throw new Error(`Unknown argument '${argument}'. Use --help to see supported options.`);
    }

    const nextArgument = argv[index + 1]?.trim() ?? "";
    const shouldConsumeNextArgument = inlineValue === undefined && Boolean(nextArgument) && !nextArgument.startsWith("--");
    const nextValue = inlineValue ?? (shouldConsumeNextArgument ? nextArgument : undefined);
    if (shouldConsumeNextArgument) {
      index += 1;
    }

    const normalizedValue = nextValue?.trim() ?? "";
    if (!normalizedValue) {
      throw new Error(`Option '--${optionName}' requires a value.`);
    }

    if (optionName === "name") {
      parsed.name = normalizedValue;
      continue;
    }

    if (optionName === "email") {
      parsed.email = normalizedValue;
      continue;
    }

    if (optionName === "password") {
      parsed.password = normalizedValue;
      continue;
    }

    if (optionName === "username") {
      parsed.username = normalizedValue;
      continue;
    }

    throw new Error(`Unknown option '--${optionName}'. Use --help to see supported options.`);
  }

  return parsed;
}

function isProbablyValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+$/.test(value);
}

export function resolveBootstrapSuperAdminInput(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
): BootstrapSuperAdminInput | null {
  const parsedOptions = parseBootstrapSuperAdminOptions(argv);
  if (parsedOptions.help) {
    return null;
  }

  const name = (parsedOptions.name ?? env.BOOTSTRAP_SUPERADMIN_NAME ?? "").trim();
  const email = normalizeAuthEmail(parsedOptions.email ?? env.BOOTSTRAP_SUPERADMIN_EMAIL ?? "");
  const password = (parsedOptions.password ?? env.BOOTSTRAP_SUPERADMIN_PASSWORD ?? "").trim();
  const explicitUsername = parsedOptions.username ?? env.BOOTSTRAP_SUPERADMIN_USERNAME ?? "";
  const username = normalizeAuthUsername(
    explicitUsername.trim() ? explicitUsername : deriveBootstrapUsername(email.split("@")[0] ?? ""),
  );

  if (!name) {
    throw new Error(
      "Super-admin name is required. Provide --name or BOOTSTRAP_SUPERADMIN_NAME.",
    );
  }

  if (!email) {
    throw new Error(
      "Super-admin email is required. Provide --email or BOOTSTRAP_SUPERADMIN_EMAIL.",
    );
  }

  if (!isProbablyValidEmail(email)) {
    throw new Error(`Invalid super-admin email '${email}'.`);
  }

  if (!password) {
    throw new Error(
      "Super-admin password is required. Provide --password or BOOTSTRAP_SUPERADMIN_PASSWORD.",
    );
  }

  if (password.length < 12) {
    throw new Error("Super-admin password must be at least 12 characters.");
  }

  if (!username) {
    throw new Error("Unable to derive a valid username from the provided input.");
  }

  return {
    name,
    email,
    password,
    username,
  };
}

export function buildBootstrapSuperAdminHelpText(): string {
  return [
    "Bootstrap the first persistent super-admin user for a Prisma-backed database.",
    "",
    "Usage:",
    "  npm run auth:bootstrap:superadmin -- --name \"Owner\" --email \"owner@example.com\" --password \"StrongPassword#2026\"",
    "",
    "Supported options:",
    "  --name <value>       Display name for the first super-admin",
    "  --email <value>      Email address for the first super-admin",
    "  --password <value>   Initial password for the first super-admin",
    "  --username <value>   Optional explicit username; defaults to email local-part",
    "  --help               Show this help text",
    "",
    "Environment variable alternatives:",
    "  BOOTSTRAP_SUPERADMIN_NAME",
    "  BOOTSTRAP_SUPERADMIN_EMAIL",
    "  BOOTSTRAP_SUPERADMIN_PASSWORD",
    "  BOOTSTRAP_SUPERADMIN_USERNAME",
    "",
    "Safety rules:",
    "  - DATA_SOURCE must resolve to prisma",
    "  - DATABASE_URL must be available",
    "  - command aborts if any AuthUser rows already exist",
  ].join("\n");
}

export async function bootstrapInitialSuperAdmin(
  argv: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const input = resolveBootstrapSuperAdminInput(argv, env);
  if (!input) {
    console.log(buildBootstrapSuperAdminHelpText());
    return;
  }

  const dataSource = resolveConfiguredDataSource(undefined);
  if (dataSource !== "prisma") {
    throw new Error("DATA_SOURCE must be prisma to bootstrap a persistent super-admin.");
  }

  const databaseUrl = resolveConfiguredString(undefined, "DATABASE_URL") ?? "";
  if (!databaseUrl.trim()) {
    throw new Error("DATABASE_URL is required to bootstrap a super-admin.");
  }

  const prisma = new PrismaClient();

  try {
    const existingAuthUserCount = await prisma.authUser.count();
    if (existingAuthUserCount > 0) {
      throw new Error(
        `Bootstrap aborted: AuthUser already contains ${existingAuthUserCount} record(s). This command is only allowed on a fresh database.`,
      );
    }

    const created = await prisma.authUser.create({
      data: {
        name: input.name,
        email: input.email,
        username: input.username,
        role: "SUPER_ADMIN",
        passwordHash: await hashAuthPasswordAsync(input.password),
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
      },
    });

    console.log("Initial super-admin created successfully.");
    console.log(`  id: ${created.id}`);
    console.log(`  name: ${created.name}`);
    console.log(`  username: ${created.username}`);
    console.log(`  email: ${created.email}`);
    console.log(`  role: ${created.role}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  bootstrapInitialSuperAdmin().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Super-admin bootstrap failed: ${message}`);
    process.exitCode = 1;
  });
}
