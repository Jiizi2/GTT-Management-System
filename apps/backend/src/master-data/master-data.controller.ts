import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import type { AuthTokenPayload } from "../auth/auth.types";
import { CreateMasterDataOptionDto } from "./dto/create-master-data-option.dto";
import { ListMasterDataOptionsDto } from "./dto/list-master-data-options.dto";
import { UpdateMasterDataOptionDto } from "./dto/update-master-data-option.dto";
import { MasterDataService } from "./master-data.service";

@Controller("master-data")
export class MasterDataController {
  constructor(@Inject(MasterDataService) private readonly masterDataService: MasterDataService) {}

  @Get("categories")
  listCategories() {
    return this.masterDataService.listCategories();
  }

  @Get("options")
  listOptions(@Query() query: ListMasterDataOptionsDto) {
    return this.masterDataService.listOptions(query.categoryKey, query.includeInactive ?? false);
  }

  @Post("options")
  createOption(
    @Body() payload: CreateMasterDataOptionDto,
    @Req()
    request: {
      authUser?: AuthTokenPayload;
    },
  ) {
    this.assertSuperAdminAccess(request.authUser);
    return this.masterDataService.createOption(payload);
  }

  @Patch("options/:optionId")
  updateOption(
    @Param("optionId") optionId: string,
    @Body() payload: UpdateMasterDataOptionDto,
    @Req()
    request: {
      authUser?: AuthTokenPayload;
    },
  ) {
    this.assertSuperAdminAccess(request.authUser);
    return this.masterDataService.updateOption(optionId, payload);
  }

  private assertSuperAdminAccess(authUser: AuthTokenPayload | undefined): void {
    if (!authUser) {
      throw new UnauthorizedException("Session is not available.");
    }

    if (authUser.accessTier !== "super-admin") {
      throw new ForbiddenException("Super Admin access is required.");
    }
  }
}
