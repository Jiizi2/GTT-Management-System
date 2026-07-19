import { Body, Controller, Get, Header, Param, Patch, Query, Req } from "@nestjs/common";
import type { AuthTokenPayload } from "../auth/auth.types";
import { Roles } from "../auth/auth.roles";
import {
  LinkVisaApplicationGroupDto,
  ListVisaApplicationsDto,
  UpdateVisaApplicationProgressDto,
} from "./dto/visa-application.dto";
import { VisaApplicationsService } from "./visa-applications.service";

type AuthenticatedRequest = { authUser?: AuthTokenPayload };

@Roles("admin", "super-admin")
@Controller("visa-applications")
export class AdminVisaApplicationsController {
  constructor(private readonly applications: VisaApplicationsService) {}

  @Get()
  @Header("Cache-Control", "private, no-store")
  list(@Query() query: ListVisaApplicationsDto) {
    return this.applications.listForAdmin(query);
  }

  @Get(":id")
  @Header("Cache-Control", "private, no-store")
  detail(@Param("id") id: string) {
    return this.applications.detailForAdmin(id);
  }

  @Patch(":id/progress")
  update(
    @Param("id") id: string,
    @Body() payload: UpdateVisaApplicationProgressDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.applications.updateProgress(id, payload, this.requireActor(request));
  }

  @Patch(":id/group")
  linkGroup(
    @Param("id") id: string,
    @Body() payload: LinkVisaApplicationGroupDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.applications.linkGroup(id, payload.groupId ?? null, this.requireActor(request));
  }

  private requireActor(request: AuthenticatedRequest): { id: string } {
    if (!request.authUser) throw new Error("Authenticated actor was not attached by the global auth guard.");
    return { id: request.authUser.id };
  }
}
