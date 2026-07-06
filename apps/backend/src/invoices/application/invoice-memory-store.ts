import { Injectable } from "@nestjs/common";
import { MemoryInvoice, MemoryInvoiceClient, randomUUID } from "../invoices-helpers";


@Injectable()
export class InvoiceMemoryStore {
  readonly clients: MemoryInvoiceClient[] = [
    {
      id: randomUUID(),
      name: "Yassir",
      sortOrder: 1,
      groupCode: "9017000001",
      groupName: "Dummy Trip Lengkap",
    },
    {
      id: randomUUID(),
      name: "Haris",
      sortOrder: 2,
    },
    {
      id: randomUUID(),
      name: "JSA",
      sortOrder: 3,
    },
  ];

  readonly invoices: MemoryInvoice[] = [];
}
