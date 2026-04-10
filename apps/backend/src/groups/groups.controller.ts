import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { CreateGroupDto } from "./dto/create-group.dto";
import { GroupsService } from "./groups.service";
import { UpdateGroupDto } from "./dto/update-group.dto";
import {
  UpsertGroupItineraryItemDto,
  UpsertGroupRaudhahDto,
  UpsertGroupVisaHotelDto,
} from "./dto/group-operations.dto";
import { ConfirmChecklistDriverDto } from "./dto/confirm-checklist-driver.dto";
import { ResetChecklistDriverDto } from "./dto/reset-checklist-driver.dto";

@Controller("groups")
export class GroupsController {
  constructor(@Inject(GroupsService) private readonly groupsService: GroupsService) {}

  @Get()
  findAll(
    @Query("q") query?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("filter") filter?: string,
  ) {
    const parsedPage = Number.parseInt(page ?? "", 10);
    const parsedPageSize = Number.parseInt(pageSize ?? "", 10);

    return this.groupsService.findAll(query, {
      page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : undefined,
      pageSize:
        Number.isFinite(parsedPageSize) && parsedPageSize > 0 ? parsedPageSize : undefined,
      filter,
    });
  }

  @Get("audit-logs")
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
  findOne(@Param("idOrCode") idOrCode: string) {
    return this.groupsService.findOneByIdOrCode(idOrCode);
  }

  @Post()
  create(@Body() payload: CreateGroupDto) {
    return this.groupsService.create(payload);
  }

  @Put(":idOrCode")
  replace(@Param("idOrCode") idOrCode: string, @Body() payload: CreateGroupDto) {
    return this.groupsService.replace(idOrCode, payload);
  }

  @Patch(":idOrCode")
  update(@Param("idOrCode") idOrCode: string, @Body() payload: UpdateGroupDto) {
    return this.groupsService.update(idOrCode, payload);
  }

  @Post(":idOrCode/itinerary")
  addItineraryItem(
    @Param("idOrCode") idOrCode: string,
    @Body() payload: UpsertGroupItineraryItemDto,
  ) {
    return this.groupsService.addItineraryItem(idOrCode, payload);
  }

  @Patch(":idOrCode/itinerary/:itemId")
  updateItineraryItem(
    @Param("idOrCode") idOrCode: string,
    @Param("itemId") itemId: string,
    @Body() payload: UpsertGroupItineraryItemDto,
  ) {
    return this.groupsService.updateItineraryItem(idOrCode, itemId, payload);
  }

  @Delete(":idOrCode/itinerary/:itemId")
  removeItineraryItem(
    @Param("idOrCode") idOrCode: string,
    @Param("itemId") itemId: string,
  ) {
    return this.groupsService.removeItineraryItem(idOrCode, itemId);
  }

  @Post(":idOrCode/checklist/confirm-driver")
  confirmChecklistDriver(
    @Param("idOrCode") idOrCode: string,
    @Body() payload: ConfirmChecklistDriverDto,
  ) {
    return this.groupsService.confirmChecklistDriver(idOrCode, payload);
  }

  @Post(":idOrCode/checklist/reset-driver")
  resetChecklistDriver(
    @Param("idOrCode") idOrCode: string,
    @Body() payload: ResetChecklistDriverDto,
  ) {
    return this.groupsService.resetChecklistDriver(idOrCode, payload);
  }

  @Post(":idOrCode/visa/hotels")
  addVisaHotelAgreement(
    @Param("idOrCode") idOrCode: string,
    @Body() payload: UpsertGroupVisaHotelDto,
  ) {
    return this.groupsService.addVisaHotelAgreement(idOrCode, payload);
  }

  @Patch(":idOrCode/visa/hotels/:hotelId")
  updateVisaHotelAgreement(
    @Param("idOrCode") idOrCode: string,
    @Param("hotelId") hotelId: string,
    @Body() payload: UpsertGroupVisaHotelDto,
  ) {
    return this.groupsService.updateVisaHotelAgreement(idOrCode, hotelId, payload);
  }

  @Delete(":idOrCode/visa/hotels/:hotelId")
  removeVisaHotelAgreement(
    @Param("idOrCode") idOrCode: string,
    @Param("hotelId") hotelId: string,
  ) {
    return this.groupsService.removeVisaHotelAgreement(idOrCode, hotelId);
  }

  @Put(":idOrCode/visa/raudhah")
  upsertPrimaryRaudhahAppointment(
    @Param("idOrCode") idOrCode: string,
    @Body() payload: UpsertGroupRaudhahDto,
  ) {
    return this.groupsService.upsertPrimaryRaudhahAppointment(idOrCode, payload);
  }

  @Delete(":idOrCode")
  @HttpCode(204)
  async remove(@Param("idOrCode") idOrCode: string): Promise<void> {
    await this.groupsService.remove(idOrCode);
  }
}
