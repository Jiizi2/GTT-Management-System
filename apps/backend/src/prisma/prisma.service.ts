import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";
import { resolveConfiguredDataSource } from "../config/app-config";

type MissingSchemaColumn = {
  table_name: string;
  column_name: string;
};

const REQUIRED_PRISMA_SCHEMA_COLUMNS: Array<{ tableName: string; columnName: string }> = [
  { tableName: "Group", columnName: "lifecycleStatus" },
  { tableName: "VisaHotelAgreement", columnName: "sourceDraftId" },
  { tableName: "VisaSetup", columnName: "busStatus" },
];

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly configService?: ConfigService) {
    super();
  }

  async onModuleInit(): Promise<void> {
    const dataSource = resolveConfiguredDataSource(this.configService);
    if (dataSource !== "prisma") {
      return;
    }

    await this.$connect();
    await this.assertRequiredSchemaReady();
  }

  async onModuleDestroy(): Promise<void> {
    const dataSource = resolveConfiguredDataSource(this.configService);
    if (dataSource !== "prisma") {
      return;
    }

    await this.$disconnect();
  }

  private async assertRequiredSchemaReady(): Promise<void> {
    const missingColumns = await this.$queryRawUnsafe<MissingSchemaColumn[]>(`
      SELECT required.table_name, required.column_name
      FROM (
        VALUES ${REQUIRED_PRISMA_SCHEMA_COLUMNS.map(
          (_column, index) => `($${index * 2 + 1}::text, $${index * 2 + 2}::text)`,
        ).join(", ")}
      ) AS required(table_name, column_name)
      WHERE NOT EXISTS (
        SELECT 1
        FROM information_schema.columns AS columns
        WHERE columns.table_schema = current_schema()
          AND columns.table_name = required.table_name
          AND columns.column_name = required.column_name
      )
      ORDER BY required.table_name, required.column_name
    `,
    ...REQUIRED_PRISMA_SCHEMA_COLUMNS.flatMap((column) => [column.tableName, column.columnName]));

    if (missingColumns.length === 0) {
      return;
    }

    const formattedColumns = missingColumns
      .map((column) => `${column.table_name}.${column.column_name}`)
      .join(", ");
    throw new Error(
      `Prisma database schema is not ready. Missing required columns: ${formattedColumns}. Run 'npm run db:deploy --workspace backend' before starting the backend with DATA_SOURCE=prisma.`,
    );
  }
}
