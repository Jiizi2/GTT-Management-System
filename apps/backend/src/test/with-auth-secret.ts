export async function withAuthSecret<T>(
  secret: string,
  fn: () => Promise<T>,
): Promise<T> {
  const previousSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = secret;
  try {
    return await fn();
  } finally {
    if (previousSecret === undefined) {
      delete process.env.AUTH_SECRET;
    } else {
      process.env.AUTH_SECRET = previousSecret;
    }
  }
}
