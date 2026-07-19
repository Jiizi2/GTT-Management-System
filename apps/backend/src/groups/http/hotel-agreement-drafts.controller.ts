import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { ApiErrorResponseDto } from "../../http/api-error-response.dto";
import { HotelAgreementDraftsService } from "../application/hotel-agreement-drafts.service";
import {
  AssignHotelAgreementDraftDto,
  HotelAgreementDraftResponseDto,
  UpsertHotelAgreementDraftDto,
} from "../dto/hotel-agreement-draft.dto";

@ApiTags("Visa Agreement Drafts")
@ApiBearerAuth("access-token")
@ApiCookieAuth("auth-cookie")
@ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
@Controller("visa/agreement-drafts")
export class HotelAgreementDraftsController {
  constructor(
    @Inject(HotelAgreementDraftsService)
    private readonly hotelAgreementDraftsService: HotelAgreementDraftsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: "List hotel agreement drafts",
    description: "Mengembalikan agreement hotel yang belum atau sudah dihubungkan ke group.",
  })
  @ApiQuery({ name: "q", required: false, example: "20269017001001" })
  @ApiQuery({ name: "status", required: false, enum: ["unassigned", "assigned"] })
  @ApiQuery({ name: "agentId", required: false })
  @ApiOkResponse({
    description: "Draft agreement berhasil dibaca.",
    type: HotelAgreementDraftResponseDto,
    isArray: true,
  })
  findAll(@Query("q") query?: string, @Query("status") status?: string, @Query("agentId") agentId?: string) {
    return agentId
      ? this.hotelAgreementDraftsService.findAll(query, status, agentId)
      : this.hotelAgreementDraftsService.findAll(query, status);
  }

  @Post()
  @ApiOperation({
    summary: "Create hotel agreement draft",
    description: "Membuat draft agreement hotel tanpa group number.",
  })
  @ApiCreatedResponse({
    description: "Draft agreement berhasil dibuat.",
    type: HotelAgreementDraftResponseDto,
  })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  create(@Body() payload: UpsertHotelAgreementDraftDto) {
    return this.hotelAgreementDraftsService.create(payload);
  }

  @Patch(":draftId")
  @ApiOperation({
    summary: "Update hotel agreement draft",
    description: "Memperbarui draft agreement hotel.",
  })
  @ApiParam({ name: "draftId", example: "cldraftagreementid123" })
  @ApiOkResponse({
    description: "Draft agreement berhasil diperbarui.",
    type: HotelAgreementDraftResponseDto,
  })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  update(@Param("draftId") draftId: string, @Body() payload: UpsertHotelAgreementDraftDto) {
    return this.hotelAgreementDraftsService.update(draftId, payload);
  }

  @Delete(":draftId")
  @HttpCode(204)
  @ApiOperation({
    summary: "Delete hotel agreement draft",
    description: "Menghapus draft agreement hotel dari inbox.",
  })
  @ApiParam({ name: "draftId", example: "cldraftagreementid123" })
  @ApiNoContentResponse({ description: "Draft agreement berhasil dihapus." })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  async remove(@Param("draftId") draftId: string): Promise<void> {
    await this.hotelAgreementDraftsService.remove(draftId);
  }

  @Post(":draftId/assign")
  @ApiOperation({
    summary: "Assign hotel agreement draft to group",
    description: "Menghubungkan draft agreement ke group dan menambahkannya ke visa setup group.",
  })
  @ApiParam({ name: "draftId", example: "cldraftagreementid123" })
  @ApiOkResponse({
    description: "Draft agreement berhasil dihubungkan ke group.",
    type: HotelAgreementDraftResponseDto,
  })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  assign(@Param("draftId") draftId: string, @Body() payload: AssignHotelAgreementDraftDto) {
    return this.hotelAgreementDraftsService.assign(draftId, payload);
  }

  @Post(":draftId/unassign")
  @ApiOperation({
    summary: "Unassign hotel agreement draft from group",
    description:
      "Melepas draft agreement dari group, menghapus link hotel agreement di visa setup group, dan mengembalikan draft ke inbox unassigned.",
  })
  @ApiParam({ name: "draftId", example: "cldraftagreementid123" })
  @ApiQuery({ name: "groupCode", required: false, example: "9017001001" })
  @ApiOkResponse({
    description: "Draft agreement berhasil dilepas dari group.",
    type: HotelAgreementDraftResponseDto,
  })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  unassign(
    @Param("draftId") draftId: string,
    @Query("groupCode") groupCode?: string,
  ) {
    return this.hotelAgreementDraftsService.unassign(draftId, groupCode);
  }
}
