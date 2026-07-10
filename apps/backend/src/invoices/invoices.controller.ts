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
  Query,
  Res,
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
  ApiForbiddenResponse,
} from "@nestjs/swagger";
import { Roles } from "../auth/auth.roles";
import { ApiErrorResponseDto } from "../http/api-error-response.dto";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import {
  InvoiceClientListItemResponseDto,
  InvoiceListItemResponseDto,
} from "./dto/invoice-response.dto";
import { UpdateInvoiceDto } from "./dto/update-invoice.dto";
import { PaginationDto } from "./dto/pagination.dto";
import { InvoicesService } from "./invoices.service";

type ResponseLike = {
  setHeader: (name: string, value: string | readonly string[]) => void;
};

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
  findAll(
    @Query() pagination: PaginationDto,
    @Res({ passthrough: true }) response: ResponseLike
  ) {
    response.setHeader("Cache-Control", "no-store, private");
    if (pagination.page === undefined && pagination.limit === undefined) {
      return this.invoicesService.findAll();
    }
    return this.invoicesService.findAllPaginated(pagination);
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
  listClients(@Res({ passthrough: true }) response: ResponseLike) {
    response.setHeader("Cache-Control", "no-store, private");
    return this.invoicesService.listClients();
  }

  @Post()
  @Roles("super-admin", "admin")
  @ApiOperation({
    summary: "Buat invoice",
    description: "Membuat invoice baru dan, bila perlu, client invoice baru.",
  })
  @ApiCreatedResponse({
    description: "Invoice berhasil dibuat.",
    type: InvoiceListItemResponseDto,
  })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  create(@Body() payload: CreateInvoiceDto) {
    return this.invoicesService.create(payload);
  }

  @Patch(":id")
  @Roles("super-admin", "admin")
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
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  update(@Param("id") id: string, @Body() payload: UpdateInvoiceDto) {
    return this.invoicesService.update(id, payload);
  }

  @Post("backfill")
  @Roles("super-admin")
  @ApiOperation({
    summary: "Backfill legacy items",
    description: "Mengimpor item invoice dari data legacy JSON ke tabel relasional.",
  })
  @ApiOkResponse({
    description: "Proses backfill selesai.",
  })
  backfill() {
    return this.invoicesService.backfillLegacyItems();
  }

  @Delete(":id")
  @Roles("super-admin", "admin")
  @ApiOperation({
    summary: "Hapus invoice",
    description: "Menghapus invoice berdasarkan ID.",
  })
  @ApiParam({ name: "id", example: "clinvoiceid123" })
  @ApiOkResponse({
    description: "Invoice berhasil dihapus.",
  })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  remove(@Param("id") id: string) {
    return this.invoicesService.delete(id);
  }
}
