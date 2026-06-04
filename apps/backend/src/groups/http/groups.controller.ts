import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from "@nestjs/swagger";
import { ApiErrorResponseDto } from "../../http/api-error-response.dto";
import { CreateGroupIdentityDto } from "../dto/create-group-identity.dto";
import { CreateGroupDto } from "../dto/create-group.dto";
import { GroupsService } from "../application/groups.service";
import { UpdateGroupDto } from "../dto/update-group.dto";
import {
  UpsertGroupItineraryItemDto,
  UpsertGroupRaudhahDto,
  UpsertGroupVisaHotelDto,
} from "../dto/group-operations.dto";
import { ConfirmChecklistDriverDto } from "../dto/confirm-checklist-driver.dto";
import { ResetChecklistDriverDto } from "../dto/reset-checklist-driver.dto";
import {
  ChecklistAssignmentSyncResponseDto,
  GroupAuditLogResponseDto,
  GroupDetailResponseDto,
  GroupSummaryResponseDto,
  PaginatedGroupDetailResponseDto,
  PaginatedGroupSummaryResponseDto,
} from "../dto/group-response.dto";
import type { GroupResponseProjection } from "../groups.service-types";

function normalizeGroupProjection(
  rawProjection?: string,
): GroupResponseProjection {
  return rawProjection?.trim().toLowerCase() === "summary"
    ? "summary"
    : "detail";
}

function normalizeBooleanQuery(rawValue?: string): boolean {
  const normalized = rawValue?.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

@ApiTags("Groups")
@ApiBearerAuth("access-token")
@ApiCookieAuth("auth-cookie")
@ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
@ApiExtraModels(
  GroupSummaryResponseDto,
  GroupDetailResponseDto,
  PaginatedGroupSummaryResponseDto,
  PaginatedGroupDetailResponseDto,
)
@Controller("groups")
export class GroupsController {
  constructor(
    @Inject(GroupsService) private readonly groupsService: GroupsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: "List groups",
    description:
      "Mengembalikan daftar grup dengan search, filter, pagination, dan projection summary/detail.",
  })
  @ApiQuery({ name: "q", required: false, example: "9017001001" })
  @ApiQuery({ name: "page", required: false, example: "1" })
  @ApiQuery({ name: "pageSize", required: false, example: "20" })
  @ApiQuery({ name: "filter", required: false, example: "missing-hotel" })
  @ApiQuery({ name: "activeOnly", required: false, example: true })
  @ApiQuery({ name: "projection", required: false, example: "summary" })
  @ApiOkResponse({
    description: "Daftar group berhasil dibaca.",
    schema: {
      oneOf: [
        {
          type: "array",
          items: {
            $ref: getSchemaPath(GroupSummaryResponseDto),
          },
        },
        {
          type: "array",
          items: {
            $ref: getSchemaPath(GroupDetailResponseDto),
          },
        },
        {
          $ref: getSchemaPath(PaginatedGroupSummaryResponseDto),
        },
        {
          $ref: getSchemaPath(PaginatedGroupDetailResponseDto),
        },
      ],
    },
  })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  findAll(
    @Query("q") query?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("filter") filter?: string,
    @Query("activeOnly") activeOnly?: string,
    @Query("projection") projection?: string,
  ) {
    const parsedPage = Number.parseInt(page ?? "", 10);
    const parsedPageSize = Number.parseInt(pageSize ?? "", 10);

    return this.groupsService.findAll(query, {
      page:
        Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : undefined,
      pageSize:
        Number.isFinite(parsedPageSize) && parsedPageSize > 0
          ? parsedPageSize
          : undefined,
      filter,
      activeOnly: normalizeBooleanQuery(activeOnly),
      projection: normalizeGroupProjection(projection),
    });
  }

  @Get("audit-logs")
  @ApiOperation({
    summary: "List group audit logs",
    description:
      "Mengembalikan audit log group dari memory atau Prisma, tergantung data source.",
  })
  @ApiQuery({ name: "groupCode", required: false, example: "9017001001" })
  @ApiQuery({ name: "limit", required: false, example: "25" })
  @ApiOkResponse({
    description: "Audit log group berhasil dibaca.",
    type: GroupAuditLogResponseDto,
    isArray: true,
  })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  listAuditLogs(
    @Query("groupCode") groupCode?: string,
    @Query("limit") limit?: string,
  ) {
    const parsedLimit = Number.parseInt(limit ?? "", 10);
    return this.groupsService.listAuditLogs(
      groupCode,
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : undefined,
    );
  }

  @Get(":idOrCode")
  @ApiOperation({
    summary: "Get group detail",
    description: "Mengembalikan detail penuh group berdasarkan ID atau code.",
  })
  @ApiParam({ name: "idOrCode", example: "9017001001" })
  @ApiOkResponse({
    description: "Detail group berhasil dibaca.",
    type: GroupDetailResponseDto,
  })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  findOne(@Param("idOrCode") idOrCode: string) {
    return this.groupsService.findOneByIdOrCode(idOrCode);
  }

  @Post()
  @ApiOperation({
    summary: "Create group",
    description:
      "Membuat group baru lengkap dengan itinerary, visa setup, notes, dan checklist bila disediakan.",
  })
  @ApiCreatedResponse({
    description: "Group berhasil dibuat.",
    type: GroupDetailResponseDto,
  })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  create(@Body() payload: CreateGroupDto) {
    return this.groupsService.create(payload);
  }

  @Post("identity")
  @ApiOperation({
    summary: "Create group identity workspace",
    description:
      "Membuat workspace group dari data entry minimal. Agreement dan itinerary bisa dihubungkan setelahnya.",
  })
  @ApiCreatedResponse({
    description: "Workspace group berhasil dibuat dari identity entry.",
    type: GroupDetailResponseDto,
  })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  createIdentity(@Body() payload: CreateGroupIdentityDto) {
    return this.groupsService.createIdentity(payload);
  }

  @Put(":idOrCode")
  @ApiOperation({
    summary: "Replace group",
    description:
      "Mengganti payload group secara penuh berdasarkan ID atau code.",
  })
  @ApiParam({ name: "idOrCode", example: "9017001001" })
  @ApiOkResponse({
    description: "Group berhasil diganti.",
    type: GroupDetailResponseDto,
  })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  replace(
    @Param("idOrCode") idOrCode: string,
    @Body() payload: CreateGroupDto,
  ) {
    return this.groupsService.replace(idOrCode, payload);
  }

  @Patch(":idOrCode")
  @ApiOperation({
    summary: "Update group",
    description:
      "Memperbarui field sederhana group tanpa mengganti payload penuh.",
  })
  @ApiParam({ name: "idOrCode", example: "9017001001" })
  @ApiOkResponse({
    description: "Group berhasil diperbarui.",
    type: GroupDetailResponseDto,
  })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  update(@Param("idOrCode") idOrCode: string, @Body() payload: UpdateGroupDto) {
    return this.groupsService.update(idOrCode, payload);
  }

  @Post(":idOrCode/itinerary")
  @ApiOperation({
    summary: "Add itinerary item",
    description: "Menambahkan itinerary item baru ke group.",
  })
  @ApiParam({ name: "idOrCode", example: "9017001001" })
  @ApiCreatedResponse({
    description: "Itinerary item berhasil ditambahkan.",
    type: GroupDetailResponseDto,
  })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  addItineraryItem(
    @Param("idOrCode") idOrCode: string,
    @Body() payload: UpsertGroupItineraryItemDto,
  ) {
    return this.groupsService.addItineraryItem(idOrCode, payload);
  }

  @Patch(":idOrCode/itinerary/:itemId")
  @ApiOperation({
    summary: "Update itinerary item",
    description: "Memperbarui itinerary item tertentu dalam group.",
  })
  @ApiParam({ name: "idOrCode", example: "9017001001" })
  @ApiParam({ name: "itemId", example: "clitineraryitemid123" })
  @ApiOkResponse({
    description: "Itinerary item berhasil diperbarui.",
    type: GroupDetailResponseDto,
  })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  updateItineraryItem(
    @Param("idOrCode") idOrCode: string,
    @Param("itemId") itemId: string,
    @Body() payload: UpsertGroupItineraryItemDto,
  ) {
    return this.groupsService.updateItineraryItem(idOrCode, itemId, payload);
  }

  @Delete(":idOrCode/itinerary/:itemId")
  @ApiOperation({
    summary: "Delete itinerary item",
    description: "Menghapus itinerary item tertentu dari group.",
  })
  @ApiParam({ name: "idOrCode", example: "9017001001" })
  @ApiParam({ name: "itemId", example: "clitineraryitemid123" })
  @ApiOkResponse({
    description: "Itinerary item berhasil dihapus.",
    type: GroupDetailResponseDto,
  })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  removeItineraryItem(
    @Param("idOrCode") idOrCode: string,
    @Param("itemId") itemId: string,
  ) {
    return this.groupsService.removeItineraryItem(idOrCode, itemId);
  }

  @Post(":idOrCode/checklist/confirm-driver")
  @ApiOperation({
    summary: "Confirm checklist driver",
    description:
      "Menambahkan atau mengonfirmasi slot driver untuk checklist assignment.",
  })
  @ApiParam({ name: "idOrCode", example: "9017001001" })
  @ApiOkResponse({
    description: "Checklist driver berhasil dikonfirmasi.",
    type: ChecklistAssignmentSyncResponseDto,
  })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  confirmChecklistDriver(
    @Param("idOrCode") idOrCode: string,
    @Body() payload: ConfirmChecklistDriverDto,
  ) {
    return this.groupsService.confirmChecklistDriver(idOrCode, payload);
  }

  @Post(":idOrCode/checklist/reset-driver")
  @ApiOperation({
    summary: "Reset checklist driver",
    description:
      "Menghapus seluruh driver dari checklist assignment yang sesuai.",
  })
  @ApiParam({ name: "idOrCode", example: "9017001001" })
  @ApiOkResponse({
    description: "Checklist driver berhasil di-reset.",
    type: ChecklistAssignmentSyncResponseDto,
  })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  resetChecklistDriver(
    @Param("idOrCode") idOrCode: string,
    @Body() payload: ResetChecklistDriverDto,
  ) {
    return this.groupsService.resetChecklistDriver(idOrCode, payload);
  }

  @Post(":idOrCode/visa/hotels")
  @ApiOperation({
    summary: "Add visa hotel agreement",
    description: "Menambahkan hotel agreement ke visa setup group.",
  })
  @ApiParam({ name: "idOrCode", example: "9017001001" })
  @ApiCreatedResponse({
    description: "Visa hotel agreement berhasil ditambahkan.",
    type: GroupDetailResponseDto,
  })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  addVisaHotelAgreement(
    @Param("idOrCode") idOrCode: string,
    @Body() payload: UpsertGroupVisaHotelDto,
  ) {
    return this.groupsService.addVisaHotelAgreement(idOrCode, payload);
  }

  @Patch(":idOrCode/visa/hotels/:hotelId")
  @ApiOperation({
    summary: "Update visa hotel agreement",
    description: "Memperbarui hotel agreement tertentu pada visa setup group.",
  })
  @ApiParam({ name: "idOrCode", example: "9017001001" })
  @ApiParam({ name: "hotelId", example: "clhotelagreementid123" })
  @ApiOkResponse({
    description: "Visa hotel agreement berhasil diperbarui.",
    type: GroupDetailResponseDto,
  })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  updateVisaHotelAgreement(
    @Param("idOrCode") idOrCode: string,
    @Param("hotelId") hotelId: string,
    @Body() payload: UpsertGroupVisaHotelDto,
  ) {
    return this.groupsService.updateVisaHotelAgreement(
      idOrCode,
      hotelId,
      payload,
    );
  }

  @Delete(":idOrCode/visa/hotels/:hotelId")
  @ApiOperation({
    summary: "Delete visa hotel agreement",
    description: "Menghapus hotel agreement tertentu dari visa setup group.",
  })
  @ApiParam({ name: "idOrCode", example: "9017001001" })
  @ApiParam({ name: "hotelId", example: "clhotelagreementid123" })
  @ApiOkResponse({
    description: "Visa hotel agreement berhasil dihapus.",
    type: GroupDetailResponseDto,
  })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  removeVisaHotelAgreement(
    @Param("idOrCode") idOrCode: string,
    @Param("hotelId") hotelId: string,
  ) {
    return this.groupsService.removeVisaHotelAgreement(idOrCode, hotelId);
  }

  @Put(":idOrCode/visa/raudhah")
  @ApiOperation({
    summary: "Upsert primary Raudhah appointment",
    description:
      "Membuat atau memperbarui appointment Raudhah utama pada visa setup group.",
  })
  @ApiParam({ name: "idOrCode", example: "9017001001" })
  @ApiOkResponse({
    description: "Appointment Raudhah berhasil diperbarui.",
    type: GroupDetailResponseDto,
  })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  upsertPrimaryRaudhahAppointment(
    @Param("idOrCode") idOrCode: string,
    @Body() payload: UpsertGroupRaudhahDto,
  ) {
    return this.groupsService.upsertPrimaryRaudhahAppointment(
      idOrCode,
      payload,
    );
  }

  @Delete(":idOrCode")
  @HttpCode(204)
  @ApiOperation({
    summary: "Delete group",
    description: "Menghapus group berdasarkan ID atau code.",
  })
  @ApiParam({ name: "idOrCode", example: "9017001001" })
  @ApiNoContentResponse({ description: "Group berhasil dihapus." })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  async remove(@Param("idOrCode") idOrCode: string): Promise<void> {
    await this.groupsService.remove(idOrCode);
  }
}
