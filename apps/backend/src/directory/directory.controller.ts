import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query } from "@nestjs/common";
import { Roles } from "../auth/auth.roles";
import { DirectoryService } from "./directory.service";
import {
  CreateDriverDto,
  CreateMuassasahDto,
  ListDriversDto,
  UpdateDriverDto,
  UpdateMuassasahDto,
} from "./dto/directory.dto";

@Controller("directory")
export class DirectoryController {
  constructor(private readonly directory: DirectoryService) {}

  @Get("muassasah")
  @Header("Cache-Control", "private, no-store")
  listMuassasah(@Query("q") query?: string) {
    return this.directory.listMuassasah(query);
  }

  @Post("muassasah")
  @Roles("super-admin")
  createMuassasah(@Body() payload: CreateMuassasahDto) {
    return this.directory.createMuassasah(payload);
  }

  @Patch("muassasah/:id")
  @Roles("super-admin")
  updateMuassasah(@Param("id") id: string, @Body() payload: UpdateMuassasahDto) {
    return this.directory.updateMuassasah(id, payload);
  }

  @Delete("muassasah/:id")
  @Roles("super-admin")
  removeMuassasah(@Param("id") id: string) {
    return this.directory.removeMuassasah(id);
  }

  @Get("drivers")
  @Header("Cache-Control", "private, no-store")
  listDrivers(@Query() query: ListDriversDto) {
    return this.directory.listDrivers(query.q, query.muassasahId);
  }

  @Post("drivers")
  @Roles("super-admin")
  createDriver(@Body() payload: CreateDriverDto) {
    return this.directory.createDriver(payload);
  }

  @Patch("drivers/:id")
  @Roles("super-admin")
  updateDriver(@Param("id") id: string, @Body() payload: UpdateDriverDto) {
    return this.directory.updateDriver(id, payload);
  }

  @Delete("drivers/:id")
  @Roles("super-admin")
  removeDriver(@Param("id") id: string) {
    return this.directory.removeDriver(id);
  }
}
