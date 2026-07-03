export async function withDataSource<T>(
  dataSource: "memory" | "prisma",
  fn: () => Promise<T>,
): Promise<T> {
  const previousDataSource = process.env.DATA_SOURCE;
  process.env.DATA_SOURCE = dataSource;
  try {
    return await fn();
  } finally {
    if (previousDataSource === undefined) {
      delete process.env.DATA_SOURCE;
    } else {
      process.env.DATA_SOURCE = previousDataSource;
    }
  }
}
