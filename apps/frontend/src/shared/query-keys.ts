export const authQueryKeys = {
  session: ["auth", "session"] as const,
};

export const groupQueryKeys = {
  all: ["groups"] as const,
  list: ["groups", "list"] as const,
  searchRoot: ["groups", "search"] as const,
  search: (query: string) => ["groups", "search", query] as const,
};
