import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ApiErrorResponseDto {
  @ApiProperty({ example: false })
  ok!: boolean;

  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: "Bad Request" })
  error!: string;

  @ApiProperty({
    oneOf: [
      {
        type: "string",
        example: "Validation failed.",
      },
      {
        type: "array",
        items: {
          type: "string",
        },
        example: ["code should not be empty", "arrivalDate must be a valid ISO 8601 date string"],
      },
    ],
  })
  message!: string | string[];

  @ApiProperty({ example: "/api/groups" })
  path!: string;

  @ApiProperty({ example: "2026-04-12T13:22:10.000Z" })
  timestamp!: string;

  @ApiPropertyOptional({ example: "8e4e446a-bfe7-45de-9cf5-b814dcb0d91b" })
  requestId?: string;
}
