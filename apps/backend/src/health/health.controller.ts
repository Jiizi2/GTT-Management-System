import { Controller, Get } from "@nestjs/common";
import { Public } from "../auth/auth.public";

@Controller("health")
export class HealthController {
  @Public()
  @Get()
  check() {
    const dataSource = (process.env.DATA_SOURCE ?? "memory").toLowerCase();

    return {
      ok: true,
      service: "backend",
      dataSource,
      timestamp: new Date().toISOString(),
    };
  }
}
