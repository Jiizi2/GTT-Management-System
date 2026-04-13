import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsNotEmpty, IsNumber, IsString, Min } from "class-validator";

export const INVOICE_LINE_ITEM_CURRENCIES = ["IDR", "USD", "SAR"] as const;

export class InvoiceLineItemDto {
  @ApiProperty({ example: "Umrah Regular Package - 8 Days" })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({ example: 1, minimum: 0 })
  @IsNumber()
  @Min(0)
  pax!: number;

  @ApiProperty({ enum: INVOICE_LINE_ITEM_CURRENCIES, example: "IDR" })
  @IsIn(INVOICE_LINE_ITEM_CURRENCIES)
  currency!: (typeof INVOICE_LINE_ITEM_CURRENCIES)[number];

  @ApiProperty({ example: 22200000, minimum: 0 })
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiProperty({ example: 22200000, minimum: 0 })
  @IsNumber()
  @Min(0)
  totalPrice!: number;

  @ApiProperty({ example: 22200000, minimum: 0 })
  @IsNumber()
  @Min(0)
  totalPriceIdr!: number;
}
