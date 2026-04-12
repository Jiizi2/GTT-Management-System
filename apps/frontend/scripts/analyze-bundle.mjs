import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const distDir = join(process.cwd(), "dist");
const metafilePath = join(process.cwd(), "build-meta", "esbuild-meta.json");

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${bytes} B`;
}

async function collectFiles(rootDir, currentDir = rootDir) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(rootDir, entryPath)));
      continue;
    }

    const fileStat = await stat(entryPath);
    files.push({
      path: relative(rootDir, entryPath).replaceAll("\\", "/"),
      bytes: fileStat.size,
    });
  }

  return files.sort((left, right) => right.bytes - left.bytes);
}

function collectTopInputContributors(outputName, metafile, limit = 5) {
  const output =
    metafile.outputs?.[outputName] ??
    metafile.outputs?.[`dist/${outputName}`] ??
    Object.entries(metafile.outputs ?? {}).find(([candidate]) => candidate.endsWith(`/${outputName}`))?.[1];
  if (!output || !output.inputs) {
    return [];
  }

  return Object.entries(output.inputs)
    .map(([inputPath, inputMeta]) => ({
      path: inputPath.replaceAll("\\", "/"),
      bytes: inputMeta.bytesInOutput ?? 0,
    }))
    .sort((left, right) => right.bytes - left.bytes)
    .slice(0, limit);
}

function printSection(title) {
  console.log(`\n${title}`);
}

async function main() {
  const metafile = JSON.parse(await readFile(metafilePath, "utf8"));
  const distFiles = await collectFiles(distDir);

  const topAssets = distFiles.slice(0, 12);
  const jsOutputs = topAssets.filter((file) => file.path.endsWith(".js"));
  const initialJs = jsOutputs.find((file) => file.path === "index.js");
  const initialCss = distFiles.find((file) => file.path === "index.css");

  console.log("Bundle Baseline");
  if (initialJs) {
    console.log(`- Initial JS: ${formatBytes(initialJs.bytes)} (${initialJs.path})`);
  }
  if (initialCss) {
    console.log(`- Initial CSS: ${formatBytes(initialCss.bytes)} (${initialCss.path})`);
  }

  printSection("Top Dist Assets");
  for (const file of topAssets) {
    console.log(`- ${file.path}: ${formatBytes(file.bytes)}`);
  }

  printSection("Top JS Contributors");
  for (const file of jsOutputs.slice(0, 6)) {
    console.log(`- ${file.path}: ${formatBytes(file.bytes)}`);
    const contributors = collectTopInputContributors(file.path, metafile);
    for (const contributor of contributors) {
      console.log(`  ${contributor.path}: ${formatBytes(contributor.bytes)}`);
    }
  }
}

main().catch((error) => {
  console.error("Bundle analysis failed:", error);
  process.exitCode = 1;
});
