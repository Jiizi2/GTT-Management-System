import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { AgentStatus, AgentType } from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { resolveConfiguredDataSource } from "../config/app-config";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAgentDto, UpdateAgentDto } from "./dto/agent.dto";

export const GTT_DIRECT_AGENT_ID = "agent_gtt_direct";

export type AgentRecord = {
  id: string;
  code: string;
  name: string;
  type: AgentType;
  status: AgentStatus;
  picName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  groupCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
};

const trimOrNull = (value?: string): string | null => value?.trim() || null;

@Injectable()
export class AgentsService {
  private readonly dataSource: "memory" | "prisma";
  private readonly memoryAgents: AgentRecord[] = [{
    id: GTT_DIRECT_AGENT_ID,
    code: "GTT-DIRECT",
    name: "GTT Direct",
    type: AgentType.DIRECT,
    status: AgentStatus.ACTIVE,
    picName: null,
    phone: null,
    email: null,
    address: null,
    notes: "Internal B2C business owner",
    groupCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }];

  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    this.dataSource = resolveConfiguredDataSource(config);
  }

  async list(query?: string, status?: AgentStatus, type?: AgentType): Promise<AgentRecord[]> {
    const normalizedQuery = query?.trim();
    if (this.dataSource === "memory") {
      return this.memoryAgents
        .filter((agent) => !status || agent.status === status)
        .filter((agent) => !type || agent.type === type)
        .filter((agent) => !normalizedQuery || `${agent.code} ${agent.name} ${agent.picName ?? ""}`.toLowerCase().includes(normalizedQuery.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    const rows = await this.prisma.agent.findMany({
      where: {
        status,
        type,
        ...(normalizedQuery ? { OR: [
          { code: { contains: normalizedQuery, mode: "insensitive" } },
          { name: { contains: normalizedQuery, mode: "insensitive" } },
          { picName: { contains: normalizedQuery, mode: "insensitive" } },
        ] } : {}),
      },
      include: { _count: { select: { groups: true } } },
      orderBy: [{ name: "asc" }],
    });
    return rows.map(({ _count, ...agent }) => ({ ...agent, groupCount: _count.groups }));
  }

  async findOne(id: string): Promise<AgentRecord> {
    const found = (await this.list()).find((agent) => agent.id === id || agent.code === id.trim().toUpperCase());
    if (!found) throw new NotFoundException(`Agent '${id}' not found.`);
    return found;
  }

  async assertActive(agentId?: string): Promise<AgentRecord> {
    const agent = await this.findOne(agentId?.trim() || GTT_DIRECT_AGENT_ID);
    if (agent.status !== AgentStatus.ACTIVE) throw new BadRequestException(`Agent '${agent.name}' is inactive.`);
    return agent;
  }

  async create(payload: CreateAgentDto): Promise<AgentRecord> {
    const code = payload.code.trim().toUpperCase();
    const data = {
      code,
      name: payload.name.trim(),
      type: payload.type ?? AgentType.PARTNER,
      picName: trimOrNull(payload.picName), phone: trimOrNull(payload.phone), email: trimOrNull(payload.email),
      address: trimOrNull(payload.address), notes: trimOrNull(payload.notes),
    };
    if (this.dataSource === "memory") {
      if (this.memoryAgents.some((agent) => agent.code === code)) throw new ConflictException(`Agent code '${code}' already exists.`);
      const now = new Date().toISOString();
      const created: AgentRecord = { id: randomUUID(), ...data, status: AgentStatus.ACTIVE, groupCount: 0, createdAt: now, updatedAt: now };
      this.memoryAgents.push(created);
      return created;
    }
    try {
      const created = await this.prisma.agent.create({ data });
      return { ...created, groupCount: 0 };
    } catch (error: any) {
      if (error?.code === "P2002") throw new ConflictException(`Agent code '${code}' already exists.`);
      throw error;
    }
  }

  async update(id: string, payload: UpdateAgentDto): Promise<AgentRecord> {
    const existing = await this.findOne(id);
    const code = payload.code?.trim().toUpperCase();
    const data = {
      ...(code ? { code } : {}), ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
      ...(payload.type !== undefined ? { type: payload.type } : {}),
      ...(payload.picName !== undefined ? { picName: trimOrNull(payload.picName) } : {}),
      ...(payload.phone !== undefined ? { phone: trimOrNull(payload.phone) } : {}),
      ...(payload.email !== undefined ? { email: trimOrNull(payload.email) } : {}),
      ...(payload.address !== undefined ? { address: trimOrNull(payload.address) } : {}),
      ...(payload.notes !== undefined ? { notes: trimOrNull(payload.notes) } : {}),
    };
    if (this.dataSource === "memory") {
      if (code && this.memoryAgents.some((agent) => agent.id !== existing.id && agent.code === code)) throw new ConflictException(`Agent code '${code}' already exists.`);
      Object.assign(existing, data, { updatedAt: new Date().toISOString() });
      return existing;
    }
    try {
      const updated = await this.prisma.agent.update({ where: { id: existing.id }, data });
      return { ...updated, groupCount: existing.groupCount };
    } catch (error: any) {
      if (error?.code === "P2002") throw new ConflictException(`Agent code '${code}' already exists.`);
      throw error;
    }
  }

  async setStatus(id: string, status: AgentStatus): Promise<AgentRecord> {
    const existing = await this.findOne(id);
    if (existing.type === AgentType.DIRECT && status === AgentStatus.INACTIVE) throw new BadRequestException("GTT Direct cannot be deactivated.");
    if (this.dataSource === "memory") {
      existing.status = status; existing.updatedAt = new Date().toISOString(); return existing;
    }
    const updated = await this.prisma.agent.update({ where: { id: existing.id }, data: { status } });
    return { ...updated, groupCount: existing.groupCount };
  }
}
