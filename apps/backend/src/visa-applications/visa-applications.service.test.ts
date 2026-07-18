import { VisaApplicationAgreementStatus, VisaApplicationDocumentStatus, VisaApplicationNusukStatus, VisaApplicationPaymentStatus, VisaApplicationStatus, VisaApplicationVisaStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { VisaApplicationsService } from "./visa-applications.service";

const current = {
  id: "application-a", documentStatus: VisaApplicationDocumentStatus.WAITING_DOCUMENT,
  agreementStatus: VisaApplicationAgreementStatus.NOT_STARTED, nusukStatus: VisaApplicationNusukStatus.NOT_STARTED,
  paymentStatus: VisaApplicationPaymentStatus.NOT_STARTED, visaStatus: VisaApplicationVisaStatus.NOT_STARTED,
};

describe("VisaApplicationsService", () => {
  it("lists monitoring records only inside the authenticated agent scope", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new VisaApplicationsService({ visaApplication: { findMany } } as unknown as PrismaService);
    await service.listForAgent("agent-a");
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { agentId: "agent-a" } }));
  });

  it("derives Ready To Send only when document, agreement, and Nusuk branches converge", async () => {
    const update = vi.fn().mockImplementation(({ data }) => ({ ...current, ...data }));
    const service = new VisaApplicationsService({ visaApplication: { findUnique: vi.fn().mockResolvedValue(current), update } } as unknown as PrismaService);
    const result = await service.updateProgress("application-a", { documentStatus: VisaApplicationDocumentStatus.VERIFIED, agreementStatus: VisaApplicationAgreementStatus.APPROVED, nusukStatus: VisaApplicationNusukStatus.GROUP_CREATED });
    expect(result.status).toBe(VisaApplicationStatus.READY_TO_SEND);
  });
});
