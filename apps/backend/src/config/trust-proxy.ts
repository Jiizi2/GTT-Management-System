export function resolveExpressTrustProxy(value: unknown): 1 | false {
  if (value === true) return 1;
  if (typeof value !== "string") return false;
  return value.trim().toLowerCase() === "true" ? 1 : false;
}
