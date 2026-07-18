import { Injectable, NotFoundException } from "@nestjs/common";
import {
  Prisma,
  VisaApplicationAgreementStatus,
  VisaApplicationDocumentStatus,
  VisaApplicationNusukStatus,
  VisaApplicationPaymentStatus,
  VisaApplicationStatus,
  VisaApplicationVisaStatus,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { UpdateVisaApplicationProgressDto } from "./dto/visa-application.dto";
const include = {
  agent: { select: { code: true, name: true } },
  documents: { orderBy: { type: "asc" as const } },
};

@Injectable()
export class VisaApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

  listForAgent(agentId: string) {
    return this.prisma.visaApplication.findMany({
      where: { agentId },
      include,
      orderBy: { createdAt: "desc" },
    });
  }

  listForAdmin() {
    return this.prisma.visaApplication.findMany({
      include,
      orderBy: { updatedAt: "desc" },
    });
  }

  async detailForAgent(agentId: string, id: string) {
    const row = await this.prisma.visaApplication.findFirst({
      where: { id, agentId },
      include,
    });
    if (!row) throw new NotFoundException("VISA_APPLICATION_NOT_FOUND");
    return row;
  }

  async updateProgress(id: string, payload: UpdateVisaApplicationProgressDto) {
    const current = await this.prisma.visaApplication.findUnique({
      where: { id },
    });
    if (!current) throw new NotFoundException("VISA_APPLICATION_NOT_FOUND");
    const facets = {
      documentStatus: payload.documentStatus ?? current.documentStatus,
      agreementStatus: payload.agreementStatus ?? current.agreementStatus,
      nusukStatus: payload.nusukStatus ?? current.nusukStatus,
      paymentStatus: payload.paymentStatus ?? current.paymentStatus,
      visaStatus: payload.visaStatus ?? current.visaStatus,
    };
    const status = this.deriveStatus(facets);
    const data: Prisma.VisaApplicationUpdateInput = {
      ...facets,
      status,
      nusukGroupNumber:
        payload.nusukGroupNumber === undefined
          ? undefined
          : payload.nusukGroupNumber.trim() || null,
      nusukReferenceNumber:
        payload.nusukReferenceNumber === undefined
          ? undefined
          : payload.nusukReferenceNumber.trim() || null,
      adminNote:
        payload.adminNote === undefined
          ? undefined
          : payload.adminNote.trim() || null,
      completedAt:
        status === VisaApplicationStatus.COMPLETED ? new Date() : undefined,
    };
    return this.prisma.visaApplication.update({ where: { id }, data, include });
  }

  private deriveStatus(value: {
    documentStatus: VisaApplicationDocumentStatus;
    agreementStatus: VisaApplicationAgreementStatus;
    nusukStatus: VisaApplicationNusukStatus;
    paymentStatus: VisaApplicationPaymentStatus;
    visaStatus: VisaApplicationVisaStatus;
  }) {
    if (value.visaStatus === VisaApplicationVisaStatus.COMPLETED)
      return VisaApplicationStatus.COMPLETED;
    if (value.visaStatus === VisaApplicationVisaStatus.ISSUED)
      return VisaApplicationStatus.VISA_ISSUED;
    if (value.visaStatus === VisaApplicationVisaStatus.PROCESSING)
      return VisaApplicationStatus.VISA_PROCESSING;
    if (value.paymentStatus === VisaApplicationPaymentStatus.COMPLETED)
      return VisaApplicationStatus.PAYMENT_COMPLETED;
    if (value.visaStatus === VisaApplicationVisaStatus.SUBMITTED)
      return VisaApplicationStatus.VISA_SUBMITTED;
    if (
      value.documentStatus === VisaApplicationDocumentStatus.VERIFIED &&
      value.agreementStatus === VisaApplicationAgreementStatus.APPROVED &&
      value.nusukStatus === VisaApplicationNusukStatus.GROUP_CREATED
    )
      return VisaApplicationStatus.READY_TO_SEND;
    if (value.nusukStatus === VisaApplicationNusukStatus.GROUP_CREATED)
      return VisaApplicationStatus.GROUP_CREATED;
    if (value.nusukStatus === VisaApplicationNusukStatus.PASSENGER_ENTERED)
      return VisaApplicationStatus.PASSENGER_ENTERED;
    if (
      value.agreementStatus === VisaApplicationAgreementStatus.WAITING_APPROVAL
    )
      return VisaApplicationStatus.WAITING_HOTEL_AGREEMENT;
    if (value.documentStatus === VisaApplicationDocumentStatus.VERIFIED)
      return VisaApplicationStatus.DOCUMENT_VERIFIED;
    if (value.documentStatus === VisaApplicationDocumentStatus.NEED_REVISION)
      return VisaApplicationStatus.NEED_REVISION;
    return VisaApplicationStatus.WAITING_DOCUMENT;
  }
}
