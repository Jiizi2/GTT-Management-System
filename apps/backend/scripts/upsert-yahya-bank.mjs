/**
 * One-off, non-destructive: upserts ONLY the Yahya Tours bank-disbursement
 * option into master data. Does not delete or touch any other row.
 *
 * Run from apps/backend so Prisma resolves and DATABASE_URL is loaded:
 *   node --env-file=.env scripts/upsert-yahya-bank.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const option = {
  categoryKey: "bank-disbursement",
  value: "yahya_tour",
  label: "BSI - 7359108286",
  sortOrder: 4,
  isActive: true,
  metadata: { bankName: "BSI", penerima: "PT YAHYA TOUR INDONESIA", accountNumber: "7359108286" },
};

async function main() {
  const result = await prisma.masterDataOption.upsert({
    where: { categoryKey_value: { categoryKey: option.categoryKey, value: option.value } },
    update: {
      label: option.label,
      sortOrder: option.sortOrder,
      isActive: option.isActive,
      metadata: option.metadata,
    },
    create: option,
  });
  console.log("Upserted bank-disbursement option:", {
    id: result.id,
    value: result.value,
    label: result.label,
  });
}

main()
  .catch((error) => {
    console.error("Failed to upsert Yahya bank option:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
