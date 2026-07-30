import { Injectable, BadRequestException } from "@nestjs/common";

@Injectable()
export class InvoiceValidator {
  validateAmounts(payload: { amount?: number; downPaymentIdr?: number }): void {
    if (payload.downPaymentIdr !== undefined && payload.downPaymentIdr < 0) {
      throw new BadRequestException("Nominal downpayment tidak boleh kurang dari 0.");
    }
    if (payload.amount !== undefined && payload.amount < 0) {
      throw new BadRequestException("Nominal amount invoice tidak boleh kurang dari 0.");
    }
  }

  validateItems(items: unknown): void {
    if (items === undefined) return;
    if (!Array.isArray(items)) {
      throw new BadRequestException("Format items invoice tidak valid.");
    }
    for (const item of items) {
      if (!item || typeof item !== "object") {
        throw new BadRequestException("Item invoice tidak valid.");
      }
      const { description, currency, pax, unitPrice } = item as Record<string, unknown>;
      if (!description || typeof description !== "string" || !description.trim()) {
        throw new BadRequestException("Uraian item invoice tidak boleh kosong.");
      }
      const cleanCurrency = String(currency).trim().toUpperCase();
      if (cleanCurrency !== "IDR" && cleanCurrency !== "USD" && cleanCurrency !== "SAR") {
        throw new BadRequestException(`Mata uang item '${cleanCurrency}' tidak valid.`);
      }
      if (Number(pax) <= 0 || !Number.isInteger(Number(pax))) {
        throw new BadRequestException("Jumlah PAX item invoice harus berupa bilangan bulat positif.");
      }
      if (Number(unitPrice) <= 0) {
        throw new BadRequestException("Harga unit item invoice harus lebih dari 0.");
      }
    }
  }

  validatePayments(notes: string | undefined): void {
    if (notes === undefined) return;
    const match = notes.match(/\[Payments:([^\]]+)\]/);
    if (match) {
      try {
        const paymentsList = JSON.parse(decodeURIComponent(match[1]));
        if (Array.isArray(paymentsList)) {
          for (const p of paymentsList) {
            if ((Number(p.amount) || 0) < 0) {
              throw new BadRequestException("Nominal pembayaran tidak boleh kurang dari 0.");
            }
          }
        }
      } catch (e) {
        throw new BadRequestException("Tag pembayaran dalam notes memiliki format JSON yang tidak valid.");
      }
    }
  }

  validateInvoicePayloadInvariants(payload: {
    amount?: number;
    downPaymentIdr?: number;
    notes?: string;
    items?: unknown;
  }): void {
    this.validateAmounts(payload);
    this.validateItems(payload.items);
    this.validatePayments(payload.notes);
  }
}
