import { ApiProperty } from "@nestjs/swagger";

export class HealthResponseDto {
  @ApiProperty({ example: true })
  ok!: boolean;

  @ApiProperty({ example: "backend" })
  service!: string;

  @ApiProperty({ enum: ["memory", "prisma"], example: "prisma" })
  dataSource!: "memory" | "prisma";

  @ApiProperty({ enum: ["up", "down", "n/a"], example: "up" })
  database!: "up" | "down" | "n/a";

  @ApiProperty({ example: "2026-04-12T13:30:00.000Z" })
  timestamp!: string;
}
