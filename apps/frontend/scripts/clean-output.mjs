import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const outputDirs = process.argv.slice(2);

if (outputDirs.length === 0) {
  console.error("Usage: node scripts/clean-output.mjs <dir> [dir...]");
  process.exitCode = 1;
} else {
  for (const outputDir of outputDirs) {
    await rm(resolve(process.cwd(), outputDir), {
      recursive: true,
      force: true,
      maxRetries: 20,
      retryDelay: 250,
    });
  }
}
