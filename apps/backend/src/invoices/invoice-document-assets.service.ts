import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { createStructuredLogger } from "../logging/create-structured-logger";
import type { AuthTokenPayload } from "../auth/auth.types";
import { InvoicesService } from "./invoices.service";

export type InvoiceDocumentAssetKind = "stamp" | "signature";

const ASSET_FILE_NAMES: Record<InvoiceDocumentAssetKind, string> = {
  stamp: "stamp.png",
  signature: "signature.png",
};
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_ASSET_BYTES = 2 * 1024 * 1024;
const DEFAULT_PRIVATE_ASSET_DIRECTORY = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  ".private",
  "invoice-document-assets",
);

@Injectable()
export class InvoiceDocumentAssetsService {
  private readonly logger = createStructuredLogger(InvoiceDocumentAssetsService.name);

  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly configService: ConfigService,
  ) {}

  async readForInvoice(args: {
    invoiceId: string;
    kind: InvoiceDocumentAssetKind;
    actor: AuthTokenPayload;
  }): Promise<Buffer> {
    const invoiceId = args.invoiceId.trim();
    const invoice = (await this.invoicesService.findAll()).find((candidate) => candidate.id === invoiceId);
    if (!invoice) throw new NotFoundException(`Invoice '${invoiceId}' not found.`);
    if (invoice.status === "Cancelled") {
      throw new ForbiddenException("Approval assets are not available for cancelled invoices.");
    }

    const configuredDirectory =
      this.configService.get<string>("INVOICE_DOCUMENT_ASSET_DIR")?.trim() ||
      DEFAULT_PRIVATE_ASSET_DIRECTORY;
    if (!path.isAbsolute(configuredDirectory)) {
      throw new ServiceUnavailableException("INVOICE_DOCUMENT_ASSET_DIR must be an absolute path.");
    }

    const assetDirectory = path.resolve(configuredDirectory);
    const assetPath = path.resolve(assetDirectory, ASSET_FILE_NAMES[args.kind]);
    if (path.dirname(assetPath) !== assetDirectory) {
      throw new ServiceUnavailableException("Invalid invoice document asset path.");
    }

    try {
      await access(assetPath);
      const metadata = await stat(assetPath);
      if (!metadata.isFile() || metadata.size <= 0 || metadata.size > MAX_ASSET_BYTES) {
        throw new Error("Asset must be a non-empty regular file no larger than 2 MiB.");
      }
      const content = await readFile(assetPath);
      if (content.length < PNG_MAGIC.length || !content.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) {
        throw new Error("Asset is not a valid PNG file.");
      }

      this.logger.info(
        {
          action: "invoice.document-asset.accessed",
          invoiceId,
          invoiceNumber: invoice.invoiceNumber,
          assetKind: args.kind,
          userId: args.actor.id,
          accessTier: args.actor.accessTier,
        },
        "Protected invoice document asset accessed.",
      );
      return content;
    } catch (error) {
      this.logger.error(
        {
          action: "invoice.document-asset.failed",
          invoiceId,
          assetKind: args.kind,
          userId: args.actor.id,
          error,
        },
        "Protected invoice document asset could not be read.",
      );
      throw new ServiceUnavailableException("Invoice approval asset is unavailable or invalid.");
    }
  }
}
