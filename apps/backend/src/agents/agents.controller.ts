import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { AgentStatus, AgentType } from "@prisma/client";
import { AgentsService } from "./agents.service";
import {
  CreateAgentDto,
  UpdateAgentDto,
  UpdateAgentStatusDto,
} from "./dto/agent.dto";
import { Roles } from "../auth/auth.roles";

@ApiTags("Agents")
@ApiBearerAuth("access-token")
@ApiCookieAuth("auth-cookie")
@Controller("agents")
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Get()
  list(
    @Query("q") query?: string,
    @Query("status") status?: AgentStatus,
    @Query("type") type?: AgentType,
  ) {
    return this.agents.list(query, status, type);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.agents.findOne(id);
  }

  @Post()
  @Roles("super-admin")
  create(@Body() payload: CreateAgentDto) {
    return this.agents.create(payload);
  }

  @Patch(":id")
  @Roles("super-admin")
  update(@Param("id") id: string, @Body() payload: UpdateAgentDto) {
    return this.agents.update(id, payload);
  }

  @Patch(":id/status")
  @Roles("super-admin")
  setStatus(@Param("id") id: string, @Body() payload: UpdateAgentStatusDto) {
    return this.agents.setStatus(id, payload.status);
  }

  @Delete(":id")
  @Roles("super-admin")
  remove(@Param("id") id: string) {
    return this.agents.remove(id);
  }
}
