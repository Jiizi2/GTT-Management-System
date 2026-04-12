import { it } from "vitest";

export function runCase(name: string, fn: () => void | Promise<void>): void {
  it(name, fn);
}
