import { describe, expect, it } from "vitest";
import { resolveExpressTrustProxy } from "./trust-proxy";

describe("resolveExpressTrustProxy", () => {
  it("accepts the boolean produced by environment validation", () => {
    expect(resolveExpressTrustProxy(true)).toBe(1);
    expect(resolveExpressTrustProxy(false)).toBe(false);
  });

  it("supports raw environment strings without trusting other values", () => {
    expect(resolveExpressTrustProxy(" TRUE ")).toBe(1);
    expect(resolveExpressTrustProxy("false")).toBe(false);
    expect(resolveExpressTrustProxy(1)).toBe(false);
    expect(resolveExpressTrustProxy(undefined)).toBe(false);
  });
});
