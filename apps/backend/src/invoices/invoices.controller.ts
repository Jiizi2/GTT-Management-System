import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Inject,
  MethodNotAllowedException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
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
import {
  InvoiceDocumentAssetsService,
  type InvoiceDocumentAssetKind,
} from "./invoice-document-assets.service";
import type { AuthTokenPayload } from "../auth/auth.types";

type ResponseLike = {
  setHeader: (name: string, value: string | readonly string[]) => void;
};

@ApiTags("Invoices")
@ApiBearerAuth("access-token")
@ApiCookieAuth("auth-cookie")
@ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
@Controller("invoices")
export class InvoicesController {
  constructor(
    @Inject(InvoicesService) private readonly invoicesService: InvoicesService,
    @Inject(InvoiceDocumentAssetsService)
    private readonly documentAssetsService: InvoiceDocumentAssetsService,
  ) {}

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
    @Res({ passthrough: true }) response: ResponseLike,
    @Query("agentId") agentId?: string,
  ) {
    response.setHeader("Cache-Control", "no-store, private");
    if (pagination.page === undefined && pagination.limit === undefined) {
      return agentId ? this.invoicesService.findAll(agentId) : this.invoicesService.findAll();
    }
    return agentId
      ? this.invoicesService.findAllPaginated(pagination, agentId)
      : this.invoicesService.findAllPaginated(pagination);
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

  @Get(":id/document-assets/:kind")
  @Roles("super-admin", "admin")
  @Header("Cache-Control", "no-store, private")
  @Header("X-Content-Type-Options", "nosniff")
  @ApiOperation({
    summary: "Read protected invoice approval asset",
    description: "Mengirim cap atau tanda tangan privat untuk invoice final dan mencatat aksesnya.",
  })
  @ApiParam({ name: "id", example: "clinvoiceid123" })
  @ApiParam({ name: "kind", enum: ["stamp", "signature"] })
  @ApiOkResponse({ description: "PNG privat berhasil dibaca." })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async readDocumentAsset(
    @Param("id") id: string,
    @Param("kind") rawKind: string,
    @Req() request: { authUser?: AuthTokenPayload },
  ): Promise<StreamableFile> {
    const kind = rawKind.trim().toLowerCase();
    if (kind !== "stamp" && kind !== "signature") {
      throw new MethodNotAllowedException("Asset kind must be 'stamp' or 'signature'.");
    }
    if (!request.authUser) throw new MethodNotAllowedException("Authenticated session is required.");
    const content = await this.documentAssetsService.readForInvoice({
      invoiceId: id,
      kind: kind as InvoiceDocumentAssetKind,
      actor: request.authUser,
    });
    return new StreamableFile(content, {
      type: "image/png",
      disposition: `inline; filename="invoice-${kind}.png"`,
      length: content.length,
    });
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
