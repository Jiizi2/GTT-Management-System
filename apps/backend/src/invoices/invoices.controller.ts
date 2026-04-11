import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  MethodNotAllowedException,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiMethodNotAllowedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { ApiErrorResponseDto } from "../http/api-error-response.dto";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import {
  InvoiceClientListItemResponseDto,
  InvoiceListItemResponseDto,
} from "./dto/invoice-response.dto";
import { UpdateInvoiceDto } from "./dto/update-invoice.dto";
import { InvoicesService } from "./invoices.service";

@ApiTags("Invoices")
@ApiBearerAuth("access-token")
@ApiCookieAuth("auth-cookie")
@ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
@Controller("invoices")
export class InvoicesController {
  constructor(@Inject(InvoicesService) private readonly invoicesService: InvoicesService) {}

  @Get()
  @ApiOperation({
    summary: "List invoices",
    description: "Mengembalikan daftar invoice untuk dashboard finance.",
  })
  @ApiOkResponse({
    description: "Daftar invoice berhasil dibaca.",
    type: InvoiceListItemResponseDto,
    isArray: true,
  })
  findAll() {
    return this.invoicesService.findAll();
  }

  @Get("clients")
  @ApiOperation({
    summary: "List invoice clients",
    description: "Mengembalikan daftar client invoice yang tersedia.",
  })
  @ApiOkResponse({
    description: "Daftar invoice client berhasil dibaca.",
    type: InvoiceClientListItemResponseDto,
    isArray: true,
  })
  listClients() {
    return this.invoicesService.listClients();
  }

  @Post()
  @ApiOperation({
    summary: "Buat invoice",
    description: "Membuat invoice baru dan, bila perlu, client invoice baru.",
  })
  @ApiCreatedResponse({
    description: "Invoice berhasil dibuat.",
    type: InvoiceListItemResponseDto,
  })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  create(@Body() payload: CreateInvoiceDto) {
    return this.invoicesService.create(payload);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Update invoice",
    description: "Memperbarui invoice yang sudah ada.",
  })
  @ApiParam({ name: "id", example: "clinvoiceid123" })
  @ApiOkResponse({
    description: "Invoice berhasil diperbarui.",
    type: InvoiceListItemResponseDto,
  })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  update(@Param("id") id: string, @Body() payload: UpdateInvoiceDto) {
    return this.invoicesService.update(id, payload);
  }

  @Delete(":id")
  @ApiMethodNotAllowedResponse({ type: ApiErrorResponseDto })
  remove(@Param("id") id: string) {
    throw new MethodNotAllowedException(
      `Invoice '${id}' cannot be deleted. Set status to CANCELLED instead.`,
    );
  }
}
