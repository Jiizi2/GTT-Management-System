import { Injectable } from "@nestjs/common";
import { isIsoDateOnly, toIsoDateOnly } from "../../utils/date-helpers";

@Injectable()
export class InvoiceNumberGenerator {
  extractInvoiceSerial(invoiceNumber: string): number | null {
    const matched = invoiceNumber.trim().match(/\/(\d+)$/);
    if (!matched) {
      return null;
    }

    const serialValue = Number.parseInt(matched[1], 10);
    if (!Number.isFinite(serialValue)) {
      return null;
    }

    return serialValue;
  }

  buildInvoiceNumber(year: string, serial: number): string {
    return `GTT/INV/${year}/${String(serial).padStart(4, "0")}`;
  }

  extractYearFromIsoDate(isoDate: string): string {
    return isIsoDateOnly(isoDate) ? isoDate.slice(0, 4) : toIsoDateOnly(new Date()).slice(0, 4);
  }

  resolveNextSerial(existingInvoiceNumbers: string[]): number {
    const maxSerial = existingInvoiceNumbers.reduce((highest, current) => {
      const parsedSerial = this.extractInvoiceSerial(current);
      if (!parsedSerial) {
        return highest;
      }

      return Math.max(highest, parsedSerial);
    }, 0);

    return maxSerial + 1;
  }

  async generateNextInvoiceNumberWithPrisma(
    year: string,
    // The only `any` left in backend production source, and it is load-bearing.
    // This is a structural stand-in for PrismaClient so the domain does not
    // depend on it and tests can pass a stub. `unknown` in parameter position
    // breaks contravariance - the real PrismaClient stops being assignable -
    // and the alternatives are coupling this file to Prisma's generated arg
    // types or adding generics that buy nothing.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prismaClient: { invoice: { findFirst: (args: any) => Promise<any>; findMany: (args: any) => Promise<any[]> } }
  ): Promise<string> {
    const latest = await prismaClient.invoice.findFirst({
      where: {
        invoiceNumber: {
          startsWith: `GTT/INV/${year}/`,
        },
      },
      select: {
        invoiceNumber: true,
      },
      orderBy: {
        invoiceNumber: "desc",
      },
    });

    if (!latest) {
      return this.buildInvoiceNumber(year, 1);
    }

    const latestSerial = this.extractInvoiceSerial(latest.invoiceNumber);
    if (latestSerial) {
      return this.buildInvoiceNumber(year, latestSerial + 1);
    }

    // Fallback for legacy malformed invoice formats that break lexical ordering.
    const records = await prismaClient.invoice.findMany({
      where: {
        invoiceNumber: {
          startsWith: `GTT/INV/${year}/`,
        },
      },
      select: {
        invoiceNumber: true,
      },
    });

    const nextSerial = this.resolveNextSerial(records.map((entry) => entry.invoiceNumber));
    return this.buildInvoiceNumber(year, nextSerial);
  }
}
