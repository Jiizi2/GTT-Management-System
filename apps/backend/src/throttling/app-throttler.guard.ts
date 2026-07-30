import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { resolveConfiguredBoolean } from "../config/app-config";
import { resolveClientIp } from "../http-origin";

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const socket =
      req.socket && typeof req.socket === "object"
        ? (req.socket as { remoteAddress?: unknown })
        : undefined;

    return resolveClientIp({
      headers: req.headers as Record<string, unknown> | undefined,
      ip: typeof req.ip === "string" ? req.ip : undefined,
      socket: socket
        ? {
            remoteAddress:
              typeof socket.remoteAddress === "string" ? socket.remoteAddress : null,
          }
        : undefined,
    }, {
      trustProxyHeaders: resolveConfiguredBoolean(undefined, "TRUST_PROXY") === true,
    });
  }
}
