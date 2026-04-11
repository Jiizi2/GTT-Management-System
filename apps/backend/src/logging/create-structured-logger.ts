import { PinoLogger } from "nestjs-pino";

type StructuredLogger = {
  info: (obj: unknown, msg?: string, ...args: unknown[]) => void;
  warn: (obj: unknown, msg?: string, ...args: unknown[]) => void;
  error: (obj: unknown, msg?: string, ...args: unknown[]) => void;
  debug: (obj: unknown, msg?: string, ...args: unknown[]) => void;
};

const noop = (): void => {};

const NOOP_LOGGER: StructuredLogger = {
  info: noop,
  warn: noop,
  error: noop,
  debug: noop,
};

export function createStructuredLogger(context: string): StructuredLogger {
  const rootLogger = (PinoLogger as unknown as {
    root?: {
      child?: (bindings: Record<string, unknown>) => StructuredLogger;
    };
  }).root;

  if (!rootLogger?.child) {
    return NOOP_LOGGER;
  }

  return rootLogger.child({ context });
}
