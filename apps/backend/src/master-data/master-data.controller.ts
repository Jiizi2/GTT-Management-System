import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Roles } from "../auth/auth.roles";
import { ApiErrorResponseDto } from "../http/api-error-response.dto";
import { CreateMasterDataOptionDto } from "./dto/create-master-data-option.dto";
import { ListMasterDataOptionsDto } from "./dto/list-master-data-options.dto";
import {
  MasterDataCategorySummaryResponseDto,
  MasterDataOptionItemResponseDto,
} from "./dto/master-data-response.dto";
import { UpdateMasterDataOptionDto } from "./dto/update-master-data-option.dto";
import { MasterDataService } from "./master-data.service";

@ApiTags("Master Data")
@ApiBearerAuth("access-token")
@ApiCookieAuth("auth-cookie")
@ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
@Controller("master-data")
export class MasterDataController {
  constructor(
    @Inject(MasterDataService)
    private readonly masterDataService: MasterDataService,
  ) {}

  @Get("categories")
  @ApiOperation({
    summary: "List master data categories",
    description:
      "Mengembalikan kategori master data beserta total dan active count masing-masing.",
  })
  @ApiOkResponse({
    description: "Ringkasan kategori master data berhasil dibaca.",
    type: MasterDataCategorySummaryResponseDto,
    isArray: true,
  })
  listCategories() {
    return this.masterDataService.listCategories();
  }

  @Get("options")
  @ApiOperation({
    summary: "List master data options",
    description:
      "Mengembalikan opsi dalam kategori tertentu, dengan opsi menampilkan item nonaktif.",
  })
  @ApiQuery({ name: "categoryKey", required: true, example: "agreement-city" })
  @ApiQuery({ name: "includeInactive", required: false, example: true })
  @ApiOkResponse({
    description: "Daftar master data option berhasil dibaca.",
    type: MasterDataOptionItemResponseDto,
    isArray: true,
  })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  listOptions(@Query() query: ListMasterDataOptionsDto) {
    return this.masterDataService.listOptions(
      query.categoryKey,
      query.includeInactive ?? false,
    );
  }

  @Post("options")
  @Roles("super-admin")
  @ApiOperation({
    summary: "Buat master data option",
    description:
      "Membuat option baru di kategori master data. Hanya untuk super-admin.",
  })
  @ApiCreatedResponse({
    description: "Master data option berhasil dibuat.",
    type: MasterDataOptionItemResponseDto,
  })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  createOption(@Body() payload: CreateMasterDataOptionDto) {
    return this.masterDataService.createOption(payload);
  }

  @Patch("options/:optionId")
  @Roles("super-admin")
  @ApiOperation({
    summary: "Update master data option",
    description:
      "Memperbarui option master data yang ada. Hanya untuk super-admin.",
  })
  @ApiParam({ name: "optionId", example: "clmasterdataoptionid123" })
  @ApiOkResponse({
    description: "Master data option berhasil diperbarui.",
    type: MasterDataOptionItemResponseDto,
  })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  updateOption(
    @Param("optionId") optionId: string,
    @Body() payload: UpdateMasterDataOptionDto,
  ) {
    return this.masterDataService.updateOption(optionId, payload);
  }

  @Delete("options/:optionId")
  @Roles("super-admin")
  @ApiOperation({
    summary: "Hapus master data option",
    description:
      "Menghapus option jika belum dipakai oleh data operasional lain. Hanya untuk super-admin.",
  })
  @ApiParam({ name: "optionId", example: "clmasterdataoptionid123" })
  @ApiOkResponse({ description: "Master data option berhasil dihapus." })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  deleteOption(@Param("optionId") optionId: string) {
    return this.masterDataService.deleteOption(optionId);
  }
}
