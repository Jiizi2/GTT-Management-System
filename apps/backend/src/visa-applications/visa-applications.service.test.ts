import {
  AgentStatus,
  VisaApplicationAgreementStatus,
  VisaApplicationDocumentStatus,
  VisaApplicationNusukStatus,
  VisaApplicationPaymentStatus,
  VisaApplicationStatus,
  VisaApplicationVisaStatus,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { deriveVisaApplicationStatus } from "./domain/derive-visa-application-status";
import { VisaApplicationsService } from "./visa-applications.service";

const current = {
  id: "application-a",
  agentId: "agent-a",
  groupId: null,
  status: VisaApplicationStatus.WAITING_DOCUMENT,
  documentStatus: VisaApplicationDocumentStatus.WAITING_DOCUMENT,
  agreementStatus: VisaApplicationAgreementStatus.NOT_STARTED,
  nusukStatus: VisaApplicationNusukStatus.NOT_STARTED,
  paymentStatus: VisaApplicationPaymentStatus.NOT_STARTED,
  visaStatus: VisaApplicationVisaStatus.NOT_STARTED,
  submittedAt: null,
  completedAt: null,
};

describe("VisaApplicationsService", () => {
  it("lists monitoring records only inside the authenticated agent scope", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new VisaApplicationsService({ visaApplication: { findMany } } as unknown as PrismaService);
    await service.listForAgent("agent-a");
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { agentId: "agent-a" } }));
  });

  it("removes internal notes, creator identity, and document storage keys from Portal Agent responses", async () => {
    const row = {
      ...current,
      createdByPortalUserId: "portal-user-a",
      adminNote: "internal only",
      progressAuditLogs: [{ id: "audit-a" }],
      documents: [{ id: "document-a", originalName: "passport.pdf", storageKey: "private/path.pdf" }],
    };
    const service = new VisaApplicationsService({
      visaApplication: { findMany: vi.fn().mockResolvedValue([row]) },
    } as unknown as PrismaService);
    const [result] = await service.listForAgent("agent-a");
    expect(result).not.toHaveProperty("adminNote");
    expect(result).not.toHaveProperty("createdByPortalUserId");
    expect(result).not.toHaveProperty("progressAuditLogs");
    expect(result.documents[0]).not.toHaveProperty("storageKey");
  });

  it("derives Ready To Send only when document, agreement, and Nusuk branches converge", () => {
    expect(
      deriveVisaApplicationStatus({
        documentStatus: VisaApplicationDocumentStatus.VERIFIED,
        agreementStatus: VisaApplicationAgreementStatus.APPROVED,
        nusukStatus: VisaApplicationNusukStatus.GROUP_CREATED,
        paymentStatus: VisaApplicationPaymentStatus.NOT_STARTED,
        visaStatus: VisaApplicationVisaStatus.NOT_STARTED,
      }),
    ).toBe(VisaApplicationStatus.READY_TO_SEND);
  });

  it("updates progress and audit atomically", async () => {
    const update = vi.fn().mockImplementation(({ data }) => ({ ...current, ...data }));
    const auditCreate = vi.fn().mockResolvedValue({ id: "audit-a" });
    const tx = {
      visaApplication: { findUnique: vi.fn().mockResolvedValue(current), update },
      visaApplicationProgressAuditLog: { create: auditCreate },
    };
    const prisma = { $transaction: (callback: (value: typeof tx) => unknown) => callback(tx) };
    const service = new VisaApplicationsService(prisma as unknown as PrismaService);
    const result = await service.updateProgress(
      "application-a",
      {
        documentStatus: VisaApplicationDocumentStatus.VERIFIED,
        agreementStatus: VisaApplicationAgreementStatus.APPROVED,
        nusukStatus: VisaApplicationNusukStatus.GROUP_CREATED,
      },
      { id: "admin-a" },
    );
    expect(result.status).toBe(VisaApplicationStatus.READY_TO_SEND);
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ actorAuthUserId: "admin-a" }) }),
    );
  });

  it("refuses linking a Group whose Agent is inactive", async () => {
    const tx = {
      visaApplication: { findUnique: vi.fn().mockResolvedValue(current) },
      group: {
        findUnique: vi.fn().mockResolvedValue({
          id: "group-a",
          code: "480900900001",
          agentId: "agent-a",
          agent: { status: AgentStatus.INACTIVE },
        }),
      },
    };
    const prisma = { $transaction: (callback: (value: typeof tx) => unknown) => callback(tx) };
    const service = new VisaApplicationsService(prisma as unknown as PrismaService);
    await expect(service.linkGroup("application-a", "group-a", { id: "admin-a" })).rejects.toThrow(
      "GROUP_AGENT_IS_NOT_ACTIVE",
    );
  });
});
