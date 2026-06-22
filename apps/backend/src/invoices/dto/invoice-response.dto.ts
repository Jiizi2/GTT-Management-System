import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { InvoiceLineItemDto } from "./invoice-line-item.dto";

export class InvoiceClientListItemResponseDto {
  @ApiProperty({ example: "clinvoiceclientid123" })
  id!: string;

  @ApiProperty({ example: "Yassir" })
  name!: string;

  @ApiProperty({ example: 1 })
  sortOrder!: number;

  @ApiProperty({ example: "01. Yassir" })
  label!: string;

  @ApiPropertyOptional({ example: "9017000001" })
  groupCode?: string;

  @ApiPropertyOptional({ example: "Dummy Trip Lengkap" })
  groupName?: string;
}

export class InvoiceListItemResponseDto {
  @ApiProperty({ example: "clinvoiceid123" })
  id!: string;

  @ApiProperty({ example: "GTT/INV/2026/0001" })
  invoiceNumber!: string;

  @ApiProperty({ example: "clinvoiceclientid123" })
  clientId!: string;

  @ApiProperty({ example: "Yassir" })
  clientName!: string;

  @ApiProperty({ example: "01. Yassir" })
  clientLabel!: string;

  @ApiProperty({ example: "YA" })
  clientInitials!: string;

  @ApiPropertyOptional({ example: "9017000001" })
  groupCode?: string;

  @ApiPropertyOptional({ example: "Dummy Trip Lengkap" })
  groupName?: string;

  @ApiProperty({ example: "2026-04-12" })
  issuedDateIso!: string;

  @ApiProperty({ example: "2026-04-19" })
  dueDateIso!: string;

  @ApiProperty({ example: 1500000 })
  amount!: number;

  @ApiProperty({ example: 500000, minimum: 0 })
  downPaymentIdr!: number;

  @ApiProperty({ enum: ["Paid", "Pending", "Overdue", "Cancelled", "Partially Paid"], example: "Pending" })
  status!: "Paid" | "Pending" | "Overdue" | "Cancelled" | "Partially Paid";

  @ApiProperty({ example: "2026-04" })
  monthKey!: string;

  @ApiPropertyOptional({ example: "PT Ghaniya Tour Travel" })
  recipientName?: string;

  @ApiPropertyOptional({ example: "Catatan tambahan invoice..." })
  notes?: string;

  @ApiPropertyOptional({
    description: "Daftar item invoice yang tersimpan.",
    type: [InvoiceLineItemDto],
  })
  items?: InvoiceLineItemDto[];
}
