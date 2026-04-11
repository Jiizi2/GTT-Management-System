import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { resolveConfiguredBoolean } from "../config/app-config";
import { resolveClientIp } from "../http-origin";

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return resolveClientIp({
      headers: req.headers as Record<string, unknown> | undefined,
      ip: typeof req.ip === "string" ? req.ip : undefined,
      socket:
        req.socket && typeof req.socket === "object"
          ? {
              remoteAddress:
                typeof req.socket.remoteAddress === "string" ? req.socket.remoteAddress : null,
            }
          : undefined,
    }, {
      trustProxyHeaders: resolveConfiguredBoolean(undefined, "TRUST_PROXY") === true,
    });
  }
}
