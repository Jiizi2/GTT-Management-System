import { Body, Controller, Get, Header, Param, Patch } from "@nestjs/common";
import { Roles } from "../auth/auth.roles";
import { UpdateVisaApplicationProgressDto } from "./dto/visa-application.dto";
import { VisaApplicationsService } from "./visa-applications.service";

@Roles("admin", "super-admin")
@Controller("visa-applications")
export class AdminVisaApplicationsController {
  constructor(private readonly applications: VisaApplicationsService) {}

  @Get()
  @Header("Cache-Control", "private, no-store")
  list() {
    return this.applications.listForAdmin();
  }

  @Patch(":id/progress")
  update(
    @Param("id") id: string,
    @Body() payload: UpdateVisaApplicationProgressDto,
  ) {
    return this.applications.updateProgress(id, payload);
  }
}
